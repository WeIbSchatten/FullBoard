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

// syncDedicated returns the desired profile list, whether it differs from list,
// and the specs whose base profile no longer exists.
func syncDedicated(list []RelayProfile, specs []DedicatedSpec) ([]RelayProfile, bool, []DedicatedSpec, error) {
	byName := make(map[string]RelayProfile, len(list))
	for _, p := range list {
		byName[p.Name] = p
	}
	wanted := make(map[string]struct{}, len(specs))
	for _, spec := range specs {
		wanted[DedicatedProfileName(spec.Email)] = struct{}{}
	}
	pool := newDedicatedPool(list, wanted)
	derived := make(map[string]RelayProfile, len(specs))
	var missing []DedicatedSpec
	for _, spec := range specs {
		name := DedicatedProfileName(spec.Email)
		base, ok := byName[spec.Base]
		if !ok || IsManagedProfileName(spec.Base) {
			missing = append(missing, spec)
			continue
		}
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
		if _, stillWanted := wanted[p.Name]; stillWanted {
			out = append(out, p)
		}
	}
	for _, spec := range specs {
		if next, ok := derived[DedicatedProfileName(spec.Email)]; ok {
			out = append(out, next)
			delete(derived, next.Name)
		}
	}
	return out, !reflect.DeepEqual(normalizedAll(out), normalizedAll(list)), missing, nil
}

// normalizedAll canonicalises a copy so a sync compares what would be written.
func normalizedAll(list []RelayProfile) []RelayProfile {
	out := make([]RelayProfile, len(list))
	for i, p := range list {
		out[i] = NormalizeProfile(p)
	}
	return out
}

// SyncDedicatedProfiles makes the managed (prefixed) profiles match specs and
// restarts the relay only when profiles.json actually changed.
func (m *Manager) SyncDedicatedProfiles(ctx context.Context, specs []DedicatedSpec) (RelayApplyResult, error) {
	snap, err := m.store.Load()
	if err != nil {
		return RelayApplyResult{}, err
	}
	if !snap.ConfigExists && len(specs) == 0 {
		return RelayApplyResult{}, nil
	}
	var changed bool
	var missing []DedicatedSpec
	err = m.store.MutateProfiles(ctx, func(list []RelayProfile) ([]RelayProfile, error) {
		next, diff, miss, serr := syncDedicated(list, specs)
		if serr != nil {
			return nil, serr
		}
		changed, missing = diff, miss
		if !diff {
			return list, errProfilesUnchanged
		}
		return next, nil
	})
	if err != nil && !errors.Is(err, errProfilesUnchanged) {
		return RelayApplyResult{}, err
	}
	var res RelayApplyResult
	if changed {
		res = m.afterCommit(ctx)
	}
	if len(missing) > 0 {
		parts := make([]string, len(missing))
		for i, spec := range missing {
			parts[i] = fmt.Sprintf("%s (base profile %q not found)", spec.Email, spec.Base)
		}
		return res, fmt.Errorf("dedicated profiles not created for: %s", strings.Join(parts, ", "))
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
