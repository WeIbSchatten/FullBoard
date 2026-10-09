package tgwebproxy

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"
)

const RelayUnit = "tproxy-server"

// statusUnits are reported on the dashboard; only controllableUnits accept actions.
var (
	statusUnits       = []string{RelayUnit, "mtproxy", "caddy", "tproxy-firewall"}
	controllableUnits = map[string]bool{RelayUnit: true, "mtproxy": true}
	unitActions       = map[string]bool{"start": true, "stop": true, "restart": true, "enable": true, "disable": true}
)

type RelayUnitStatus struct {
	Unit          string `json:"unit" example:"tproxy-server"`
	ActiveState   string `json:"activeState" example:"active"`
	SubState      string `json:"subState" example:"running"`
	UnitFileState string `json:"unitFileState" example:"enabled"`
	MainPID       int    `json:"mainPid" example:"1234"`
	Since         string `json:"since" example:"Fri 2026-10-09 18:00:00 UTC"`
	Controllable  bool   `json:"controllable" example:"true"`
}

func systemdAvailable() bool {
	if runtime.GOOS != "linux" {
		return false
	}
	if _, err := exec.LookPath("systemctl"); err != nil {
		return false
	}
	_, err := os.Stat("/run/systemd/system")
	return err == nil
}

func (m *Manager) unitStatus(ctx context.Context, unit string) RelayUnitStatus {
	st := RelayUnitStatus{Unit: unit, ActiveState: "unknown", Controllable: controllableUnits[unit]}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	out, err := m.run(ctx, "systemctl", "show", unit+".service", "--no-pager",
		"-p", "ActiveState", "-p", "SubState", "-p", "UnitFileState", "-p", "MainPID", "-p", "ActiveEnterTimestamp")
	if err != nil {
		return st
	}
	for _, line := range strings.Split(string(out), "\n") {
		key, value, ok := strings.Cut(strings.TrimSpace(line), "=")
		if !ok {
			continue
		}
		switch key {
		case "ActiveState":
			st.ActiveState = value
		case "SubState":
			st.SubState = value
		case "UnitFileState":
			st.UnitFileState = value
		case "MainPID":
			st.MainPID, _ = strconv.Atoi(value)
		case "ActiveEnterTimestamp":
			st.Since = value
		}
	}
	return st
}

func (m *Manager) relayActive(ctx context.Context) bool {
	st := m.unitStatus(ctx, RelayUnit)
	return st.ActiveState == "active" || st.ActiveState == "activating" || st.ActiveState == "reloading"
}

// ControlUnit runs a systemctl action. Starting the relay first re-runs
// `-check` so a broken config is reported here instead of a crash loop.
func (m *Manager) ControlUnit(ctx context.Context, unit, action string) error {
	if !m.supported() {
		return errUnsupported
	}
	if !controllableUnits[unit] {
		return fmt.Errorf("unit %q is not managed by the panel", unit)
	}
	if !unitActions[action] {
		return fmt.Errorf("unsupported action %q", action)
	}
	if unit == RelayUnit && (action == "start" || action == "restart") {
		if err := m.store.Check(ctx); err != nil {
			return err
		}
	}
	return m.systemctl(ctx, action, unit+".service")
}

func (m *Manager) systemctl(ctx context.Context, args ...string) error {
	ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()
	out, err := m.run(ctx, "systemctl", args...)
	if err != nil {
		return fmt.Errorf("systemctl %s: %s", strings.Join(args, " "), firstNonEmpty(strings.TrimSpace(string(out)), err.Error()))
	}
	return nil
}

// Logs returns the last lines of a unit's journal; units are allowlisted.
func (m *Manager) Logs(ctx context.Context, unit string, lines int) (string, error) {
	if !m.supported() {
		return "", errUnsupported
	}
	known := false
	for _, u := range statusUnits {
		known = known || u == unit
	}
	if !known {
		return "", fmt.Errorf("unit %q is not managed by the panel", unit)
	}
	lines = min(max(lines, 10), 1000)
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	out, err := m.run(ctx, "journalctl", "-u", unit+".service", "--no-pager", "-o", "short-iso", "-n", strconv.Itoa(lines))
	if err != nil {
		return "", fmt.Errorf("journalctl: %s", firstNonEmpty(strings.TrimSpace(string(out)), err.Error()))
	}
	return string(out), nil
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}
