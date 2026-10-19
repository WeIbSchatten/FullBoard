package tgwebproxy

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"time"
)

// DedicatedPrefix marks profiles owned by client bindings; a sync deletes any
// prefixed profile whose binding is gone, so users may not create their own.
const DedicatedPrefix = "fb:"

const maxProfileNameLength = 64

// DedicatedSpec asks for one per-client profile cloned from Base (carrier mode
// and limits); Secret/Backend pin values, otherwise they are kept or generated.
type DedicatedSpec struct {
	Email   string `json:"email" example:"alice"`
	Base    string `json:"base" example:"default"`
	Secret  string `json:"secret,omitempty" example:"aabbccddeeff00112233445566778899"`
	Backend string `json:"backend,omitempty" example:"127.0.0.1:31234"`
	// Suspended keeps the profile (and so the client's link) but parks it on
	// SuspendedBackend, which no MTProxy serves, while the client is disabled.
	Suspended bool `json:"suspended,omitempty" example:"false"`
}

// SuspendedBackend is a loopback port the panel never listens on.
const SuspendedBackend = "127.0.0.1:1"

// DedicatedProfileName is deterministic so a binding finds its profile again
// without a stored name; an email too long for the relay's name rule is hashed.
func DedicatedProfileName(email string) string {
	key := strings.ToLower(strings.TrimSpace(email))
	name := DedicatedPrefix + key
	if len(name) <= maxProfileNameLength {
		return name
	}
	sum := sha256.Sum256([]byte(key))
	return DedicatedPrefix + hex.EncodeToString(sum[:16])
}

func IsManagedProfileName(name string) bool { return strings.HasPrefix(name, DedicatedPrefix) }

func newProfileSecret() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

// NewProfileSecret is the exported form used when the panel pre-provisions a
// matching MTProto backend before writing profiles.json.
func NewProfileSecret() (string, error) { return newProfileSecret() }

// syncDedicated returns owner's desired profile list, whether it differs from
// list, and why any spec was skipped; profiles of other owners are left alone.
func syncDedicated(list []RelayProfile, specs []DedicatedSpec, owner string, own *dedicatedOwners, now time.Time) ([]RelayProfile, bool, []string, error) {
	own.Seen[owner] = now.Unix()
	byName := make(map[string]RelayProfile, len(list))
	for _, p := range list {
		byName[p.Name] = p
	}
	stale := func(o string) bool {
		return o != LocalDedicatedOwner && now.Sub(time.Unix(own.Seen[o], 0)) > dedicatedOwnerGrace
	}
	var problems []string
	accepted := make([]DedicatedSpec, 0, len(specs))
	keep := map[string]struct{}{}
	for _, spec := range specs {
		name := DedicatedProfileName(spec.Email)
		if o := own.Owners[name]; o != "" && o != owner && !stale(o) {
			problems = append(problems, fmt.Sprintf("%s (managed by %s)", spec.Email, o))
			continue
		}
		if base, ok := byName[spec.Base]; !ok || IsManagedProfileName(base.Name) {
			problems = append(problems, fmt.Sprintf("%s (base profile %q not found)", spec.Email, spec.Base))
			continue
		}
		accepted = append(accepted, spec)
		keep[name] = struct{}{}
	}
	keepUnlessMine := func(p RelayProfile) bool {
		o := own.Owners[p.Name]
		if o != "" {
			return o != owner
		}
		if owner != LocalDedicatedOwner {
			return true
		}
		since, seen := own.Orphans[p.Name]
		if !seen {
			own.Orphans[p.Name] = now.Unix()
			return true
		}
		return now.Sub(time.Unix(since, 0)) <= dedicatedOwnerGrace
	}
	for _, p := range list {
		if _, wanted := keep[p.Name]; !wanted && IsManagedProfileName(p.Name) && keepUnlessMine(p) {
			keep[p.Name] = struct{}{}
		}
	}

	pool := newDedicatedPool(list, keep)
	derived := make(map[string]RelayProfile, len(accepted))
	for _, spec := range accepted {
		name := DedicatedProfileName(spec.Email)
		base := byName[spec.Base]
		next := RelayProfile{Name: name, Backend: spec.Backend, CarrierMode: base.CarrierMode}
		if spec.Suspended {
			next.Backend = SuspendedBackend
		}
		if next.Backend == "" {
			backend, err := pool.backendFor(byName[name])
			if err != nil {
				return nil, false, nil, err
			}
			next.Backend = backend
		}
		if base.Limits != nil {
			limits := *base.Limits
			next.Limits = &limits
		}
		switch {
		case spec.Secret != "":
			next.Secret = spec.Secret
		default:
			if existing, found := byName[name]; found {
				next.Secret = existing.Secret
			} else {
				secret, err := newProfileSecret()
				if err != nil {
					return nil, false, nil, err
				}
				next.Secret = secret
			}
		}
		derived[name] = next
		own.Owners[name] = owner
	}

	out := make([]RelayProfile, 0, len(list)+len(derived))
	for _, p := range list {
		if !IsManagedProfileName(p.Name) {
			out = append(out, p)
			continue
		}
		if next, ok := derived[p.Name]; ok {
			out = append(out, next)
			delete(derived, p.Name)
			continue
		}
		if _, kept := keep[p.Name]; kept {
			out = append(out, p)
		}
	}
	for _, spec := range accepted {
		if next, ok := derived[DedicatedProfileName(spec.Email)]; ok {
			out = append(out, next)
			delete(derived, next.Name)
		}
	}
	pruneDedicatedOwners(own, out)
	return out, !reflect.DeepEqual(normalizedAll(out), normalizedAll(list)), problems, nil
}

// pruneDedicatedOwners forgets owners and orphan clocks of profiles that are gone.
func pruneDedicatedOwners(own *dedicatedOwners, out []RelayProfile) {
	present := make(map[string]struct{}, len(out))
	for _, p := range out {
		present[p.Name] = struct{}{}
	}
	for name := range own.Owners {
		if _, ok := present[name]; !ok {
			delete(own.Owners, name)
		}
	}
	for name := range own.Orphans {
		if _, ok := present[name]; !ok || own.Owners[name] != "" {
			delete(own.Orphans, name)
		}
	}
}

// normalizedAll canonicalises a copy so a sync compares what would be written.
func normalizedAll(list []RelayProfile) []RelayProfile {
	out := make([]RelayProfile, len(list))
	for i, p := range list {
		out[i] = NormalizeProfile(p)
	}
	return out
}

// SyncDedicatedProfiles makes owner's managed (prefixed) profiles match specs,
// leaving other owners' alone, and restarts the relay only on a real change.
func (m *Manager) SyncDedicatedProfiles(ctx context.Context, owner string, specs []DedicatedSpec) (RelayApplyResult, error) {
	snap, err := m.store.Load()
	if err != nil {
		return RelayApplyResult{}, err
	}
	if !snap.ConfigExists && len(specs) == 0 {
		return RelayApplyResult{}, nil
	}
	var problems []string
	changed, err := m.store.mutateDedicated(ctx, func(list []RelayProfile, own *dedicatedOwners) ([]RelayProfile, bool, error) {
		next, diff, skipped, serr := syncDedicated(list, specs, owner, own, dedicatedNow())
		problems = skipped
		return next, diff, serr
	})
	if err != nil {
		return RelayApplyResult{}, err
	}
	var res RelayApplyResult
	if changed {
		res = m.afterCommit(ctx)
	}
	if len(problems) > 0 {
		return res, fmt.Errorf("dedicated profiles not created for: %s", strings.Join(problems, ", "))
	}
	return res, nil
}

// dedicatedPool packs dedicated profiles onto panel-run MTProxy ports, at most
// maxSecretsPerMTProxy per port, keeping a profile on the port it already has.
type dedicatedPool struct {
	load     map[string]int
	reserved map[string]bool
	order    []string
}

func newDedicatedPool(list []RelayProfile, wanted map[string]struct{}) *dedicatedPool {
	pool := &dedicatedPool{load: map[string]int{}, reserved: map[string]bool{}}
	for _, p := range list {
		pool.reserved[p.Backend] = true
		if _, keep := wanted[p.Name]; !keep || !IsManagedProfileName(p.Name) || !pool.reusable(p.Backend) {
			continue
		}
		if _, seen := pool.load[p.Backend]; !seen {
			pool.order = append(pool.order, p.Backend)
		}
		pool.load[p.Backend]++
	}
	return pool
}

func (pool *dedicatedPool) reusable(backend string) bool {
	return servedBackend(backend)
}

func (pool *dedicatedPool) backendFor(existing RelayProfile) (string, error) {
	if IsManagedProfileName(existing.Name) && pool.reusable(existing.Backend) && pool.load[existing.Backend] > 0 {
		return existing.Backend, nil
	}
	for _, backend := range pool.order {
		if pool.load[backend] < maxSecretsPerMTProxy {
			pool.load[backend]++
			return backend, nil
		}
	}
	for range 8 {
		port, err := FreeLoopbackPort()
		if err != nil {
			return "", err
		}
		backend := loopbackAddr(port)
		if pool.reserved[backend] || port == StockBackendPort {
			continue
		}
		pool.reserved[backend] = true
		pool.order = append(pool.order, backend)
		pool.load[backend] = 1
		return backend, nil
	}
	return "", errors.New("no free loopback port for a dedicated MTProxy backend")
}
