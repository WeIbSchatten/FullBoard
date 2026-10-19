package tgwebproxy

import (
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"time"
)

// LocalDedicatedOwner is the relay host's own panel; a master that manages the
// host remotely syncs under its own owner id.
const LocalDedicatedOwner = "local"

// dedicatedOwnerGrace is how long an owner may go without syncing before another
// may take its profiles over, and how long an unowned legacy profile is kept.
const dedicatedOwnerGrace = 15 * time.Minute

var dedicatedNow = time.Now

// dedicatedOwners records which syncing panel owns each managed profile, so the
// host's panel and a remote master stop deleting each other's profiles.
type dedicatedOwners struct {
	Owners  map[string]string `json:"owners"`
	Seen    map[string]int64  `json:"seen"`
	Orphans map[string]int64  `json:"orphans"`
}

func dedicatedOwnersPath(p Paths) string {
	return filepath.Join(filepath.Dir(p.ProfilesFile), "dedicated-owners.json")
}

func (s *Store) loadOwnersLocked() (*dedicatedOwners, error) {
	own := &dedicatedOwners{}
	raw, err := os.ReadFile(dedicatedOwnersPath(s.paths))
	switch {
	case err == nil:
		if err := json.Unmarshal(raw, own); err != nil {
			return nil, err
		}
	case !errors.Is(err, fs.ErrNotExist):
		return nil, err
	}
	if own.Owners == nil {
		own.Owners = map[string]string{}
	}
	if own.Seen == nil {
		own.Seen = map[string]int64{}
	}
	if own.Orphans == nil {
		own.Orphans = map[string]int64{}
	}
	return own, nil
}

func (s *Store) saveOwnersLocked(own *dedicatedOwners) error {
	raw, err := json.Marshal(own)
	if err != nil {
		return err
	}
	path := dedicatedOwnersPath(s.paths)
	tmp := path + candidateSuffix
	if err := writeExclusive(tmp, raw, 0o600); err != nil {
		return wrapConfigWriteError(err)
	}
	prepareReplace(path)
	return os.Rename(tmp, path)
}

// mutateDedicated runs fn with the profile list and owner registry under the
// store lock; profiles.json is rewritten (and checked) only when fn reports a change.
func (s *Store) mutateDedicated(ctx context.Context, fn func([]RelayProfile, *dedicatedOwners) ([]RelayProfile, bool, error)) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	snap, err := s.loadLocked()
	if err != nil {
		return false, err
	}
	if !snap.ConfigExists {
		return false, errors.New("config.json does not exist yet; save the relay configuration first")
	}
	own, err := s.loadOwnersLocked()
	if err != nil {
		return false, err
	}
	next, changed, err := fn(append([]RelayProfile(nil), snap.Profiles...), own)
	if err != nil {
		return false, err
	}
	if changed {
		if err := s.applyLocked(ctx, snap.Config, next); err != nil {
			return false, err
		}
	}
	return changed, s.saveOwnersLocked(own)
}
