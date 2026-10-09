package tgwebproxy

import (
	"context"
	"errors"
	"fmt"
	"os"
	"runtime"
)

var errUnsupported = errors.New("tg-web-proxy management requires Linux with systemd")

// Manager is the single entry point the web service uses; it pairs the file
// Store with systemd control and the admin probe.
type Manager struct {
	store *Store
	run   commandRunner
	jobs  *jobRunner
	// supported is swappable so tests can exercise the systemd paths off Linux.
	supported func() bool
}

func NewManager(paths Paths, run commandRunner) *Manager {
	if run == nil {
		run = execRunner
	}
	return &Manager{
		store:     NewStore(paths, run),
		run:       run,
		jobs:      &jobRunner{dir: paths.JobDir, sourceDir: paths.SourceDir, run: run},
		supported: systemdAvailable,
	}
}

func (m *Manager) Store() *Store { return m.store }

type RelayStatus struct {
	Supported       bool              `json:"supported" example:"true"`
	Platform        string            `json:"platform" example:"linux/amd64"`
	BinaryInstalled bool              `json:"binaryInstalled" example:"true"`
	BinaryPath      string            `json:"binaryPath" example:"/usr/local/bin/tproxy-server"`
	ConfigPath      string            `json:"configPath" example:"/etc/tproxy-server/config.json"`
	ProfilesPath    string            `json:"profilesPath" example:"/etc/tproxy-server/profiles.json"`
	ConfigExists    bool              `json:"configExists" example:"true"`
	ProfilesExists  bool              `json:"profilesExists" example:"true"`
	ProfilesMode    string            `json:"profilesMode" example:"0400"`
	ProfilesModeOK  bool              `json:"profilesModeOk" example:"true"`
	ProfileCount    int               `json:"profileCount" example:"1"`
	Hostname        string            `json:"hostname" example:"proxy.example.com"`
	BasePath        string            `json:"basePath" example:""`
	ConfigError     string            `json:"configError" example:""`
	Units           []RelayUnitStatus `json:"units"`
	Admin           *RelayAdminProbe  `json:"admin"`
	Job             RelayJobStatus    `json:"job"`
}

func (m *Manager) Status(ctx context.Context) RelayStatus {
	paths := m.store.Paths()
	st := RelayStatus{
		Supported:    m.supported(),
		Platform:     runtime.GOOS + "/" + runtime.GOARCH,
		BinaryPath:   paths.Binary,
		ConfigPath:   paths.ConfigFile,
		ProfilesPath: paths.ProfilesFile,
		ProfilesMode: FileMode(paths.ProfilesFile),
		Units:        []RelayUnitStatus{},
	}
	if _, err := os.Stat(paths.Binary); err == nil {
		st.BinaryInstalled = true
	}
	st.ProfilesModeOK = profilesModeSafe(st.ProfilesMode)
	snap, err := m.store.Load()
	if err != nil {
		st.ConfigError = err.Error()
	} else {
		st.ConfigExists, st.ProfilesExists = snap.ConfigExists, snap.ProfilesExists
		st.ProfileCount = len(snap.Profiles)
		st.Hostname, st.BasePath = snap.Config.PublicHostname, snap.Config.BasePath
		if snap.ConfigExists {
			probe := ProbeAdmin(ctx, snap.Config.AdminListen)
			st.Admin = &probe
		}
	}
	if st.Supported {
		for _, unit := range statusUnits {
			st.Units = append(st.Units, m.unitStatus(ctx, unit))
		}
	}
	st.Job = m.jobs.status(ctx)
	return st
}

// profilesModeSafe matches the relay's rule: no group/other permission bits.
func profilesModeSafe(mode string) bool {
	var perm uint32
	if _, err := fmt.Sscanf(mode, "%o", &perm); err != nil {
		return false
	}
	return perm&0o077 == 0
}

type RelayApplyResult struct {
	Restarted    bool   `json:"restarted" example:"true"`
	RestartError string `json:"restartError" example:""`
}

// afterCommit restarts a running relay: it reads its config only at start-up.
func (m *Manager) afterCommit(ctx context.Context) RelayApplyResult {
	if !m.supported() || !m.relayActive(ctx) {
		return RelayApplyResult{}
	}
	if err := m.systemctl(ctx, "restart", RelayUnit+".service"); err != nil {
		return RelayApplyResult{RestartError: err.Error()}
	}
	return RelayApplyResult{Restarted: true}
}

func (m *Manager) SaveConfig(ctx context.Context, cfg RelayConfig, initial *RelayProfile) (RelayApplyResult, error) {
	if err := m.store.SaveConfig(ctx, cfg, initial); err != nil {
		return RelayApplyResult{}, err
	}
	return m.afterCommit(ctx), nil
}

func (m *Manager) AddProfile(ctx context.Context, p RelayProfile) (RelayApplyResult, error) {
	p = NormalizeProfile(p)
	err := m.store.MutateProfiles(ctx, func(list []RelayProfile) ([]RelayProfile, error) {
		for _, existing := range list {
			if existing.Name == p.Name {
				return nil, fmt.Errorf("profile %q already exists", p.Name)
			}
		}
		return append(list, p), nil
	})
	if err != nil {
		return RelayApplyResult{}, err
	}
	return m.afterCommit(ctx), nil
}

func (m *Manager) UpdateProfile(ctx context.Context, name string, p RelayProfile) (RelayApplyResult, error) {
	p = NormalizeProfile(p)
	err := m.store.MutateProfiles(ctx, func(list []RelayProfile) ([]RelayProfile, error) {
		for i := range list {
			if list[i].Name == name {
				list[i] = p
				return list, nil
			}
		}
		return nil, fmt.Errorf("profile %q not found", name)
	})
	if err != nil {
		return RelayApplyResult{}, err
	}
	return m.afterCommit(ctx), nil
}

func (m *Manager) DeleteProfile(ctx context.Context, name string) (RelayApplyResult, error) {
	err := m.store.MutateProfiles(ctx, func(list []RelayProfile) ([]RelayProfile, error) {
		for i := range list {
			if list[i].Name == name {
				return append(list[:i], list[i+1:]...), nil
			}
		}
		return nil, fmt.Errorf("profile %q not found", name)
	})
	if err != nil {
		return RelayApplyResult{}, err
	}
	return m.afterCommit(ctx), nil
}

func (m *Manager) Share(name string) (RelayShareInfo, error) {
	snap, err := m.store.Load()
	if err != nil {
		return RelayShareInfo{}, err
	}
	if !snap.ConfigExists {
		return RelayShareInfo{}, errors.New("config.json does not exist yet")
	}
	for _, p := range snap.Profiles {
		if p.Name == name {
			return BuildShareInfo(snap.Config.PublicHostname, snap.Config.BasePath, p)
		}
	}
	return RelayShareInfo{}, fmt.Errorf("profile %q not found", name)
}

func (m *Manager) StartInstall(ctx context.Context, req RelayInstallRequest) (RelayJobStatus, error) {
	if !m.supported() {
		return RelayJobStatus{}, errUnsupported
	}
	return m.jobs.startInstall(ctx, req)
}

func (m *Manager) StartUpdate(ctx context.Context) (RelayJobStatus, error) {
	if !m.supported() {
		return RelayJobStatus{}, errUnsupported
	}
	if _, err := os.Stat(m.store.Paths().Binary); err != nil {
		return RelayJobStatus{}, ErrBinaryMissing
	}
	return m.jobs.startUpdate(ctx)
}

func (m *Manager) JobStatus(ctx context.Context) RelayJobStatus { return m.jobs.status(ctx) }
