package tgwebproxy

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
)

const (
	profilesFileMode fs.FileMode = 0o400
	configFileMode   fs.FileMode = 0o640
	candidateSuffix              = ".fullboard-candidate"
	backupSuffix                 = ".fullboard-prev"
	serviceGroup                 = "tproxy"
)

var ErrBinaryMissing = errors.New("tproxy-server binary not found; install it first")

type Paths struct {
	ConfigFile   string
	ProfilesFile string
	Binary       string
	SourceDir    string
	JobDir       string
}

func DefaultPaths(jobDir string) Paths {
	return Paths{
		ConfigFile:   "/etc/tproxy-server/config.json",
		ProfilesFile: "/etc/tproxy-server/profiles.json",
		Binary:       "/usr/local/bin/tproxy-server",
		SourceDir:    "/usr/local/src/tproxy-server",
		JobDir:       jobDir,
	}
}

// commandRunner executes an external command and returns its combined output.
type commandRunner func(ctx context.Context, name string, args ...string) ([]byte, error)

func execRunner(ctx context.Context, name string, args ...string) ([]byte, error) {
	return exec.CommandContext(ctx, name, args...).CombinedOutput()
}

// Store owns the relay's config.json/profiles.json. Every write goes through
// Apply so nothing reaches disk without passing `tproxy-server -check`.
type Store struct {
	paths Paths
	run   commandRunner
	mu    sync.Mutex
}

func NewStore(paths Paths, run commandRunner) *Store {
	if run == nil {
		run = execRunner
	}
	return &Store{paths: paths, run: run}
}

func (s *Store) Paths() Paths { return s.paths }

// RelaySnapshot is the current on-disk state; Exists flags let the UI start a fresh
// host from NewRelayConfig instead of failing.
type RelaySnapshot struct {
	Config         RelayConfig    `json:"config"`
	ConfigExists   bool           `json:"configExists" example:"true"`
	Profiles       []RelayProfile `json:"profiles"`
	ProfilesExists bool           `json:"profilesExists" example:"true"`
}

func (s *Store) Load() (RelaySnapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.loadLocked()
}

func (s *Store) loadLocked() (RelaySnapshot, error) {
	snap := RelaySnapshot{Config: NewRelayConfig(), Profiles: []RelayProfile{}}
	raw, err := os.ReadFile(s.paths.ConfigFile)
	switch {
	case err == nil:
		cfg, perr := ParseRelayConfig(raw)
		if perr != nil {
			return RelaySnapshot{}, perr
		}
		snap.Config, snap.ConfigExists = cfg, true
	case !errors.Is(err, fs.ErrNotExist):
		return RelaySnapshot{}, err
	}
	raw, err = os.ReadFile(s.paths.ProfilesFile)
	switch {
	case err == nil:
		profiles, perr := ParseProfiles(raw)
		if perr != nil {
			return RelaySnapshot{}, perr
		}
		snap.Profiles, snap.ProfilesExists = profiles, true
	case !errors.Is(err, fs.ErrNotExist):
		return RelaySnapshot{}, err
	}
	return snap, nil
}

// SaveConfig replaces config.json, keeping the current profiles. initial seeds
// profiles.json on a host that has none, since the relay requires one.
func (s *Store) SaveConfig(ctx context.Context, cfg RelayConfig, initial *RelayProfile) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	snap, err := s.loadLocked()
	if err != nil {
		return err
	}
	profiles := snap.Profiles
	if len(profiles) == 0 {
		if initial == nil {
			return errors.New("profiles.json is empty; provide an initial profile")
		}
		profiles = []RelayProfile{*initial}
	}
	return s.applyLocked(ctx, cfg, profiles)
}

// errProfilesUnchanged lets a mutation decline to write: MutateProfiles then
// commits nothing and returns it, so the caller can skip the relay restart.
var errProfilesUnchanged = errors.New("profiles unchanged")

// MutateProfiles applies fn to the current profile list and commits the result.
func (s *Store) MutateProfiles(ctx context.Context, fn func([]RelayProfile) ([]RelayProfile, error)) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	snap, err := s.loadLocked()
	if err != nil {
		return err
	}
	if !snap.ConfigExists {
		return errors.New("config.json does not exist yet; save the relay configuration first")
	}
	next, err := fn(append([]RelayProfile(nil), snap.Profiles...))
	if err != nil {
		return err
	}
	return s.applyLocked(ctx, snap.Config, next)
}

// Check runs `tproxy-server -check` against the committed files.
func (s *Store) Check(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.checkLocked(ctx, s.paths.ConfigFile, s.paths.ProfilesFile)
}

func (s *Store) checkLocked(ctx context.Context, configPath, profilesPath string) error {
	if _, err := os.Stat(s.paths.Binary); err != nil {
		return ErrBinaryMissing
	}
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	out, err := s.run(ctx, s.paths.Binary, "-config", configPath, "-profiles-file", profilesPath, "-check")
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = err.Error()
		}
		return fmt.Errorf("tproxy-server -check failed: %s", msg)
	}
	return nil
}

// applyLocked writes candidates beside the live files (so relative token_key_file
// and public_dir resolve identically), checks them, then renames them in place.
func (s *Store) applyLocked(ctx context.Context, cfg RelayConfig, profiles []RelayProfile) error {
	for i := range profiles {
		profiles[i] = NormalizeProfile(profiles[i])
	}
	if err := cfg.Validate(); err != nil {
		return err
	}
	if err := ValidateProfiles(profiles, cfg.Limits); err != nil {
		return err
	}
	previous, err := os.ReadFile(s.paths.ConfigFile)
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		return err
	}
	configBytes, err := mergeConfigJSON(previous, cfg)
	if err != nil {
		return err
	}
	profileBytes, err := encodeProfiles(profiles)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(s.paths.ConfigFile), 0o750); err != nil {
		return wrapConfigWriteError(err)
	}
	if err := os.MkdirAll(filepath.Dir(s.paths.ProfilesFile), 0o750); err != nil {
		return wrapConfigWriteError(err)
	}

	configCandidate := s.paths.ConfigFile + candidateSuffix
	profilesCandidate := s.paths.ProfilesFile + candidateSuffix
	defer os.Remove(configCandidate)
	defer os.Remove(profilesCandidate)
	if err := writeExclusive(configCandidate, configBytes, configFileMode); err != nil {
		return wrapConfigWriteError(err)
	}
	if err := writeExclusive(profilesCandidate, profileBytes, profilesFileMode); err != nil {
		return wrapConfigWriteError(err)
	}
	if err := s.checkLocked(ctx, configCandidate, profilesCandidate); err != nil {
		return err
	}
	if err := commitFile(configCandidate, s.paths.ConfigFile, configFileMode); err != nil {
		return err
	}
	return commitFile(profilesCandidate, s.paths.ProfilesFile, profilesFileMode)
}

// wrapConfigWriteError points operators at the fullboard sandbox when /etc is
// read-only under ProtectSystem=full without ReadWritePaths for tproxy-server.
func wrapConfigWriteError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, syscall.EROFS) || strings.Contains(strings.ToLower(err.Error()), "read-only file system") {
		return fmt.Errorf("%w; add ReadWritePaths=-/etc/tproxy-server to fullboard.service (or a drop-in under fullboard.service.d/) and restart the panel", err)
	}
	return err
}

func writeExclusive(path string, data []byte, mode fs.FileMode) error {
	prepareReplace(path)
	_ = os.Remove(path)
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return err
	}
	if _, err := f.Write(data); err != nil {
		f.Close()
		return err
	}
	if err := f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	return os.Chmod(path, mode)
}

// commitFile keeps the previous version as *.fullboard-prev, carries over its
// owner (root:tproxy on a stock install) and atomically renames the candidate.
func commitFile(candidate, target string, mode fs.FileMode) error {
	if info, err := os.Stat(target); err == nil {
		copyOwner(info, candidate)
		if data, rerr := os.ReadFile(target); rerr == nil {
			backup := target + backupSuffix
			if werr := writeExclusive(backup, data, mode); werr == nil {
				copyOwner(info, backup)
			}
		}
	} else {
		assignServiceGroup(candidate)
	}
	if err := os.Chmod(candidate, mode); err != nil {
		return err
	}
	prepareReplace(target)
	return os.Rename(candidate, target)
}

// FileMode reports the permission bits of path, or "" when it does not exist.
func FileMode(path string) string {
	info, err := os.Stat(path)
	if err != nil {
		return ""
	}
	return fmt.Sprintf("%04o", info.Mode().Perm())
}
