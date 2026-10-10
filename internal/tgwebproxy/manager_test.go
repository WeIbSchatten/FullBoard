package tgwebproxy

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func newTestManager(t *testing.T, runner *fakeRunner) (*Manager, Paths) {
	t.Helper()
	store, paths := newTestStore(t, runner)
	m := NewManager(paths, runner.run)
	m.store = store
	m.supported = func() bool { return true }
	return m, paths
}

func TestControlUnitRestartIsBlockedByFailingCheck(t *testing.T) {
	runner := &fakeRunner{respond: func(name string, _ []string) ([]byte, error) {
		if strings.HasSuffix(name, "tproxy-server") {
			return []byte("configuration error: bad profiles"), errors.New("exit status 1")
		}
		return nil, nil
	}}
	m, _ := newTestManager(t, runner)

	err := m.ControlUnit(context.Background(), RelayUnit, "restart")
	if err == nil || !strings.Contains(err.Error(), "bad profiles") {
		t.Fatalf("error = %v, want the -check failure", err)
	}
	for _, c := range runner.calls {
		if c.name == "systemctl" {
			t.Fatalf("systemctl was invoked despite a failing check: %v", c.args)
		}
	}
}

func TestControlUnitRejectsUnmanagedUnit(t *testing.T) {
	runner := &fakeRunner{}
	m, _ := newTestManager(t, runner)
	if err := m.ControlUnit(context.Background(), "ssh", "stop"); err == nil || !strings.Contains(err.Error(), "not managed") {
		t.Fatalf("error = %v, want unmanaged-unit rejection", err)
	}
	if len(runner.calls) != 0 {
		t.Fatalf("commands ran for an unmanaged unit: %v", runner.calls)
	}
}

func TestInstallSecretNeverReachesCommandLineOrScript(t *testing.T) {
	runner := &fakeRunner{}
	m, paths := newTestManager(t, runner)
	const secret = "8561944064fc730cbfa4473562d8ec59"

	_, err := m.StartInstall(context.Background(), RelayInstallRequest{
		Hostname: "proxy.example.com", Email: "admin@example.com", Secret: secret,
		SiteUpstream: "http://127.0.0.1:3000", BasePath: "none",
	})
	if err != nil {
		t.Fatalf("StartInstall: %v", err)
	}
	var launched bool
	for _, c := range runner.calls {
		if strings.Contains(strings.Join(c.args, " "), secret) {
			t.Fatalf("secret leaked into %s argv", c.name)
		}
		launched = launched || c.name == "systemd-run"
	}
	if !launched {
		t.Fatal("installer job was not launched through systemd-run")
	}
	script, err := os.ReadFile(paths.JobDir + "/job.sh")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(script), secret) {
		t.Fatal("secret written into the job script")
	}
	if !strings.Contains(string(script), "'--site-upstream' 'http://127.0.0.1:3000'") {
		t.Fatalf("installer flags missing from script:\n%s", script)
	}
	for _, needle := range []string{
		`export HOME="${HOME:-/root}"`,
		`export GOMODCACHE=`,
		`export GOPATH=`,
	} {
		if !strings.Contains(string(script), needle) {
			t.Fatalf("job script missing %q:\n%s", needle, script)
		}
	}
	var sawHomeSetenv bool
	for _, c := range runner.calls {
		if c.name != "systemd-run" {
			continue
		}
		joined := strings.Join(c.args, " ")
		if strings.Contains(joined, "--setenv HOME=/root") &&
			strings.Contains(joined, "--setenv GOMODCACHE=/root/go/pkg/mod") {
			sawHomeSetenv = true
		}
	}
	if !sawHomeSetenv {
		t.Fatal("systemd-run missing HOME/GOMODCACHE --setenv for the Go module cache")
	}
	stored, err := os.ReadFile(paths.JobDir + "/job.secret")
	if err != nil || strings.TrimSpace(string(stored)) != secret {
		t.Fatalf("secret file = %q, %v", stored, err)
	}
}

func TestAfterCommitWarnsWithoutPatchingCaddy(t *testing.T) {
	runner := &fakeRunner{}
	m, _ := newTestManager(t, runner)
	caddyPath := filepath.Join(t.TempDir(), "Caddyfile")
	bare := "host {\n\tencode gzip\n}\n"
	if err := os.WriteFile(caddyPath, []byte(bare), 0o600); err != nil {
		t.Fatal(err)
	}
	prev := caddyfileForEncode
	caddyfileForEncode = caddyPath
	t.Cleanup(func() { caddyfileForEncode = prev })

	if _, err := m.SaveConfig(context.Background(), testConfig(), &RelayProfile{
		Name: "ws", Secret: "000102030405060708090a0b0c0d0e0f", Backend: "127.0.0.1:2398", CarrierMode: "websocket",
	}); err != nil {
		t.Fatalf("SaveConfig: %v", err)
	}
	res := m.afterCommit(context.Background())
	if res.CaddyWarning == "" {
		t.Fatal("expected CaddyWarning when bare encode + websocket profile")
	}
	raw, err := os.ReadFile(caddyPath)
	if err != nil {
		t.Fatal(err)
	}
	if string(raw) != bare {
		t.Fatalf("profile save must not rewrite Caddyfile;\ngot:\n%s", raw)
	}
	for _, c := range runner.calls {
		if c.name == "systemctl" && len(c.args) >= 2 && c.args[1] == "caddy.service" {
			t.Fatalf("profile save must not touch caddy.service: %v", c.args)
		}
	}
}

func TestFixCaddyEncodeUsesReloadOrRestart(t *testing.T) {
	runner := &fakeRunner{}
	m, _ := newTestManager(t, runner)
	caddyPath := filepath.Join(t.TempDir(), "Caddyfile")
	if err := os.WriteFile(caddyPath, []byte("host {\n\tencode gzip\n}\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	prev := caddyfileForEncode
	caddyfileForEncode = caddyPath
	t.Cleanup(func() { caddyfileForEncode = prev })

	changed, err := m.FixCaddyEncode(context.Background())
	if err != nil || !changed {
		t.Fatalf("FixCaddyEncode: changed=%v err=%v", changed, err)
	}
	raw, err := os.ReadFile(caddyPath)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), "encode @not_h2_ws gzip") {
		t.Fatalf("Caddyfile not patched: %s", raw)
	}
	var sawReloadOrRestart bool
	for _, c := range runner.calls {
		if c.name == "systemctl" && len(c.args) >= 2 && c.args[0] == "reload-or-restart" && c.args[1] == "caddy.service" {
			sawReloadOrRestart = true
		}
	}
	if !sawReloadOrRestart {
		t.Fatalf("expected systemctl reload-or-restart caddy.service, calls=%v", runner.calls)
	}
}

func TestProbeAdminRefusesNonLoopbackAddress(t *testing.T) {
	probe := ProbeAdmin(context.Background(), "192.0.2.1:8081")
	if probe.Reachable || !strings.Contains(probe.Error, "loopback") {
		t.Fatalf("probe = %+v, want a loopback refusal without dialing", probe)
	}
}

func TestProbeAdminReadsHealthReadinessAndMetrics(t *testing.T) {
	srv := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/healthz":
			_, _ = w.Write([]byte("ok"))
		case "/readyz":
			http.Error(w, "backend unavailable", http.StatusServiceUnavailable)
		case "/metrics":
			_, _ = w.Write([]byte("# HELP x\ntproxy_sessions_live 3\ntproxy_streams_live 17\n"))
		}
	}))
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	srv.Listener = listener
	srv.Start()
	defer srv.Close()

	probe := ProbeAdmin(context.Background(), listener.Addr().String())
	if !probe.Reachable || !probe.Healthy || probe.Ready {
		t.Fatalf("probe = %+v, want reachable+healthy, not ready", probe)
	}
	if probe.ReadyDetail != "backend unavailable" {
		t.Fatalf("ready detail = %q", probe.ReadyDetail)
	}
	if probe.Metrics["tproxy_sessions_live"] != 3 || probe.Metrics["tproxy_streams_live"] != 17 {
		t.Fatalf("metrics = %v", probe.Metrics)
	}
}
