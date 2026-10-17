package tgwebproxy

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"time"
)

// The relay hands each stream to an official MTProxy as opaque obfuscated2
// bytes, so a profile backend must accept that plain secret; mtg cannot.
const (
	StockBackendPort       = 2398
	managedBackendUnit     = "fullboard-mtproxy-"
	maxSecretsPerMTProxy   = 16
	managedBackendFirewall = "fullboard_mtproxy"
)

// MTProxyPaths locate the official MTProxy the upstream installer builds.
type MTProxyPaths struct {
	Binary     string
	AESSecret  string
	ConfigFile string
	EnvFile    string
}

var DefaultMTProxyPaths = MTProxyPaths{
	Binary:     "/opt/MTProxy/objs/bin/mtproto-proxy",
	AESSecret:  "/etc/mtproxy/proxy-secret",
	ConfigFile: "/etc/mtproxy/proxy-multi.conf",
	EnvFile:    "/etc/mtproxy/mtproxy.env",
}

// RelayBackendsStatus reports the panel-run MTProxy listeners behind profiles.
type RelayBackendsStatus struct {
	Managed []RelayManagedBackend `json:"managed"`
	Error   string                `json:"error,omitempty" example:""`
}

type RelayManagedBackend struct {
	Backend  string   `json:"backend" example:"127.0.0.1:40123"`
	Profiles []string `json:"profiles"`
	Unit     string   `json:"unit" example:"fullboard-mtproxy-40123"`
	Active   bool     `json:"active" example:"true"`
	External bool     `json:"external" example:"false"`
}

type backendGroup struct {
	port     int
	secrets  []string
	profiles []string
}

// servedBackend reports whether the panel runs the MTProxy behind backend.
func servedBackend(backend string) bool {
	port := backendPort(backend)
	return port != 0 && port != StockBackendPort && backend != SuspendedBackend
}

func backendPort(backend string) int {
	_, port, err := net.SplitHostPort(backend)
	if err != nil {
		return 0
	}
	n, _ := strconv.Atoi(port)
	return n
}

// desiredBackends groups profiles by backend port; the stock port belongs to
// the installer's mtproxy.service and is never taken over.
func desiredBackends(profiles []RelayProfile) ([]backendGroup, error) {
	byPort := map[int]*backendGroup{}
	for _, p := range profiles {
		if !servedBackend(p.Backend) {
			continue
		}
		port := backendPort(p.Backend)
		raw, err := DecodeSecret(p.Secret)
		if err != nil {
			return nil, fmt.Errorf("profile %q: %w", p.Name, err)
		}
		g := byPort[port]
		if g == nil {
			g = &backendGroup{port: port}
			byPort[port] = g
		}
		secret := hex.EncodeToString(raw[len(raw)-16:])
		if !slices.Contains(g.secrets, secret) {
			g.secrets = append(g.secrets, secret)
		}
		g.profiles = append(g.profiles, p.Name)
	}
	out := make([]backendGroup, 0, len(byPort))
	for _, g := range byPort {
		if len(g.secrets) > maxSecretsPerMTProxy {
			return nil, fmt.Errorf("backend 127.0.0.1:%d carries %d secrets; MTProxy accepts at most %d", g.port, len(g.secrets), maxSecretsPerMTProxy)
		}
		slices.Sort(g.secrets)
		slices.Sort(g.profiles)
		out = append(out, *g)
	}
	slices.SortFunc(out, func(a, b backendGroup) int { return a.port - b.port })
	return out, nil
}

type mtproxyEnv struct {
	workers, maxConnections string
	natArgs                 []string
}

func readMTProxyEnv(path string) mtproxyEnv {
	env := mtproxyEnv{workers: "1", maxConnections: "4096"}
	f, err := os.Open(path)
	if err != nil {
		return env
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		key, value, ok := strings.Cut(strings.TrimSpace(sc.Text()), "=")
		if !ok {
			continue
		}
		value = strings.Trim(strings.TrimSpace(value), `"'`)
		switch key {
		case "MTPROXY_WORKERS":
			if value != "" {
				env.workers = value
			}
		case "MTPROXY_MAX_CONNECTIONS":
			if value != "" {
				env.maxConnections = value
			}
		case "MTPROXY_NAT_ARGS":
			env.natArgs = strings.Fields(value)
		}
	}
	return env
}

func managedBackendUnitName(port int) string {
	return managedBackendUnit + strconv.Itoa(port)
}

// mtproxyArgs mirrors the stock mtproxy.service command line. No --address:
// MTProxy binds its outbound middle-end sockets to it too.
func mtproxyArgs(paths MTProxyPaths, env mtproxyEnv, g backendGroup, statsPort int) []string {
	args := []string{paths.Binary, "-u", "mtproxy", "-p", strconv.Itoa(statsPort), "-H", strconv.Itoa(g.port)}
	for _, s := range g.secrets {
		args = append(args, "-S", s)
	}
	args = append(args, env.natArgs...)
	return append(args, "--aes-pwd", paths.AESSecret, paths.ConfigFile, "-M", env.workers, "-C", env.maxConnections)
}

// backendFingerprint changes whenever the instance must restart: new secrets,
// new env, or a refreshed proxy-multi.conf from the upstream timer.
func backendFingerprint(paths MTProxyPaths, env mtproxyEnv, g backendGroup) string {
	h := sha256.New()
	fmt.Fprintln(h, strings.Join(mtproxyArgs(paths, env, g, 0), " "))
	if st, err := os.Stat(paths.ConfigFile); err == nil {
		fmt.Fprintln(h, st.ModTime().UnixNano(), st.Size())
	}
	return hex.EncodeToString(h.Sum(nil))[:16]
}

func backendDescription(g backendGroup, statsPort int, fingerprint string) string {
	return fmt.Sprintf("FullBoard MTProxy backend 127.0.0.1:%d stats=%d fp=%s", g.port, statsPort, fingerprint)
}

func parseBackendDescription(desc string) (statsPort int, fingerprint string) {
	for _, field := range strings.Fields(desc) {
		if v, ok := strings.CutPrefix(field, "stats="); ok {
			statsPort, _ = strconv.Atoi(v)
		}
		if v, ok := strings.CutPrefix(field, "fp="); ok {
			fingerprint = v
		}
	}
	return statsPort, fingerprint
}

// FreeLoopbackPort asks the kernel for an unused loopback TCP port.
func FreeLoopbackPort() (int, error) {
	ln, err := (&net.ListenConfig{}).Listen(context.Background(), "tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	port := ln.Addr().(*net.TCPAddr).Port
	_ = ln.Close()
	return port, nil
}

// portBusy is swappable: tests run without the real listeners they describe.
var portBusy = func(port int) bool {
	d := net.Dialer{Timeout: 300 * time.Millisecond}
	conn, err := d.DialContext(context.Background(), "tcp", net.JoinHostPort("127.0.0.1", strconv.Itoa(port)))
	if err != nil {
		return false
	}
	_ = conn.Close()
	return true
}

type unitState struct {
	active      bool
	description string
}

func (m *Manager) managedUnitState(ctx context.Context, unit string) unitState {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	out, err := m.run(ctx, "systemctl", "show", unit+".service", "--no-pager", "-p", "ActiveState", "-p", "Description")
	if err != nil {
		return unitState{}
	}
	var st unitState
	for _, line := range strings.Split(string(out), "\n") {
		key, value, _ := strings.Cut(strings.TrimSpace(line), "=")
		switch key {
		case "ActiveState":
			st.active = value == "active" || value == "activating" || value == "reloading"
		case "Description":
			st.description = value
		}
	}
	return st
}

func (m *Manager) listManagedUnits(ctx context.Context) []string {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	out, err := m.run(ctx, "systemctl", "list-units", "--all", "--plain", "--no-legend", "--no-pager", managedBackendUnit+"*")
	if err != nil {
		return nil
	}
	var units []string
	for _, line := range strings.Split(string(out), "\n") {
		fields := strings.Fields(line)
		if len(fields) == 0 || !strings.HasPrefix(fields[0], managedBackendUnit) {
			continue
		}
		units = append(units, strings.TrimSuffix(fields[0], ".service"))
	}
	return units
}

// ReconcileBackends runs one official MTProxy per non-stock backend port so
// every profile, dedicated or hand-made, has a listener that knows its secret.
func (m *Manager) ReconcileBackends(ctx context.Context) RelayBackendsStatus {
	m.backendsMu.Lock()
	defer m.backendsMu.Unlock()
	st := m.reconcileBackendsLocked(ctx)
	m.lastBackends = st
	return st
}

// LastBackends is the most recent reconcile, so status reads never act.
func (m *Manager) LastBackends() RelayBackendsStatus {
	m.backendsMu.Lock()
	defer m.backendsMu.Unlock()
	if m.lastBackends.Managed == nil {
		return RelayBackendsStatus{Managed: []RelayManagedBackend{}, Error: m.lastBackends.Error}
	}
	return m.lastBackends
}

func (m *Manager) reconcileBackendsLocked(ctx context.Context) RelayBackendsStatus {
	st := RelayBackendsStatus{Managed: []RelayManagedBackend{}}
	if !m.supported() {
		return st
	}
	snap, err := m.store.Load()
	if err != nil {
		st.Error = err.Error()
		return st
	}
	groups, err := desiredBackends(snap.Profiles)
	if err != nil {
		st.Error = err.Error()
		return st
	}
	wanted := map[string]bool{}
	for _, g := range groups {
		wanted[managedBackendUnitName(g.port)] = true
	}
	for _, unit := range m.listManagedUnits(ctx) {
		if !wanted[unit] {
			_ = m.systemctl(ctx, "stop", unit+".service")
			_, _ = m.run(ctx, "systemctl", "reset-failed", unit+".service")
		}
	}
	if len(groups) == 0 {
		m.applyBackendFirewall(ctx, nil)
		return st
	}
	if _, err := os.Stat(m.mtproxy.Binary); err != nil {
		st.Error = fmt.Sprintf("official MTProxy is not installed at %s; reinstall the relay from the panel", m.mtproxy.Binary)
		return st
	}
	env := readMTProxyEnv(m.mtproxy.EnvFile)
	var guarded []int
	var errs []string
	for _, g := range groups {
		unit := managedBackendUnitName(g.port)
		row := RelayManagedBackend{Backend: loopbackAddr(g.port), Profiles: g.profiles, Unit: unit}
		fp := backendFingerprint(m.mtproxy, env, g)
		cur := m.managedUnitState(ctx, unit)
		statsPort, curFP := parseBackendDescription(cur.description)
		switch {
		case cur.active && curFP == fp:
			row.Active = true
		case !cur.active && portBusy(g.port):
			row.External = true
		default:
			port, serr := m.startManagedBackend(ctx, unit, env, g, fp)
			if serr != nil {
				errs = append(errs, fmt.Sprintf("%s: %v", row.Backend, serr))
			}
			row.Active, statsPort = serr == nil, port
		}
		if !row.External {
			guarded = append(guarded, g.port)
			if statsPort > 0 {
				guarded = append(guarded, statsPort)
			}
		}
		st.Managed = append(st.Managed, row)
	}
	m.applyBackendFirewall(ctx, guarded)
	if m.backendFirewallErr != "" {
		errs = append(errs, m.backendFirewallErr)
	}
	if len(errs) > 0 {
		st.Error = strings.Join(errs, "; ")
	}
	return st
}

func loopbackAddr(port int) string { return net.JoinHostPort("127.0.0.1", strconv.Itoa(port)) }

func (m *Manager) startManagedBackend(ctx context.Context, unit string, env mtproxyEnv, g backendGroup, fp string) (int, error) {
	statsPort, err := FreeLoopbackPort()
	if err != nil {
		return 0, err
	}
	_, _ = m.run(ctx, "systemctl", "stop", unit+".service")
	_, _ = m.run(ctx, "systemctl", "reset-failed", unit+".service")
	args := []string{
		"--unit=" + unit, "--description=" + backendDescription(g, statsPort, fp), "--collect",
		"--property=Restart=always", "--property=RestartSec=3s", "--property=LimitNOFILE=1048576",
		"--property=WorkingDirectory=" + filepath.Dir(m.mtproxy.Binary),
		"--",
	}
	args = append(args, mtproxyArgs(m.mtproxy, env, g, statsPort)...)
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	if out, err := m.run(ctx, "systemd-run", args...); err != nil {
		return 0, fmt.Errorf("systemd-run: %s", firstNonEmpty(strings.TrimSpace(string(out)), err.Error()))
	}
	return statsPort, nil
}

// applyBackendFirewall keeps managed MTProxy ports loopback-only, like the
// upstream tproxy-firewall table does for the stock 2398/8888.
func (m *Manager) applyBackendFirewall(ctx context.Context, ports []int) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	rules := backendFirewallRules(ports)
	if rules == m.backendFirewall {
		if rules == "" {
			return
		}
		// nftables.service restarts flush every table; re-apply when it vanished.
		if _, err := m.run(ctx, "nft", "list", "table", "inet", managedBackendFirewall); err == nil {
			return
		}
	}
	_, _ = m.run(ctx, "nft", "delete", "table", "inet", managedBackendFirewall)
	m.backendFirewall, m.backendFirewallErr = rules, ""
	if rules == "" {
		return
	}
	path := filepath.Join(m.store.Paths().JobDir, "mtproxy-backends.nft")
	err := os.MkdirAll(filepath.Dir(path), 0o700)
	if err == nil {
		err = os.WriteFile(path, []byte(rules), 0o600)
	}
	if err == nil {
		var out []byte
		if out, err = m.run(ctx, "nft", "-f", path); err != nil {
			err = errors.New(firstNonEmpty(strings.TrimSpace(string(out)), err.Error()))
		}
	}
	if err != nil {
		m.backendFirewall, m.backendFirewallErr = "", "firewall for managed MTProxy ports: "+err.Error()
	}
}

func backendFirewallRules(ports []int) string {
	if len(ports) == 0 {
		return ""
	}
	ports = slices.Clone(ports)
	slices.Sort(ports)
	set := make([]string, len(ports))
	for i, p := range ports {
		set[i] = strconv.Itoa(p)
	}
	return fmt.Sprintf("table inet %s {\n\tchain input {\n\t\ttype filter hook input priority -10; policy accept;\n\t\tiifname != \"lo\" tcp dport { %s } drop\n\t}\n}\n",
		managedBackendFirewall, strings.Join(set, ", "))
}
