package tgwebproxy

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

func useFakeMTProxy(t *testing.T, m *Manager) {
	t.Helper()
	dir := t.TempDir()
	m.mtproxy = MTProxyPaths{
		Binary:     filepath.Join(dir, "mtproto-proxy"),
		AESSecret:  filepath.Join(dir, "proxy-secret"),
		ConfigFile: filepath.Join(dir, "proxy-multi.conf"),
		EnvFile:    filepath.Join(dir, "mtproxy.env"),
	}
	if err := os.WriteFile(m.mtproxy.Binary, []byte("#!/bin/true\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	env := "MTPROXY_SECRET=000102030405060708090a0b0c0d0e0f\nMTPROXY_WORKERS=2\nMTPROXY_NAT_ARGS=--nat-info 10.0.0.5:198.51.100.7\n"
	if err := os.WriteFile(m.mtproxy.EnvFile, []byte(env), 0o600); err != nil {
		t.Fatal(err)
	}
	prev := portBusy
	portBusy = func(int) bool { return false }
	t.Cleanup(func() { portBusy = prev })
}

// startedSecrets maps each systemd-run'd backend port to the -S secrets it got.
func startedSecrets(calls []recordedCall) map[string][]string {
	out := map[string][]string{}
	for _, c := range calls {
		if c.name != "systemd-run" {
			continue
		}
		var port string
		var secrets []string
		for i := 0; i+1 < len(c.args); i++ {
			switch c.args[i] {
			case "-H":
				port = c.args[i+1]
			case "-S":
				secrets = append(secrets, c.args[i+1])
			}
		}
		out[port] = secrets
	}
	return out
}

func TestReconcileBackendsServesSecondAndDedicatedProfiles(t *testing.T) {
	second := RelayProfile{Name: "second", Secret: "ffeeddccbbaa99887766554433221100", Backend: "127.0.0.1:2399", CarrierMode: "websocket"}
	m := seedManager(t, validProfile(), second)
	if _, err := m.SyncDedicatedProfiles(context.Background(), []DedicatedSpec{{Email: "a@x", Base: "default"}, {Email: "b@x", Base: "second"}}); err != nil {
		t.Fatalf("sync: %v", err)
	}
	a, _ := profileByName(t, m, DedicatedProfileName("a@x"))
	b, _ := profileByName(t, m, DedicatedProfileName("b@x"))
	runner := &fakeRunner{}
	m.run = runner.run
	useFakeMTProxy(t, m)

	st := m.ReconcileBackends(context.Background())
	if st.Error != "" {
		t.Fatalf("reconcile error: %s", st.Error)
	}
	// One MTProxy keeps its own pool of middle-end connections and burns CPU
	// even when idle; on a 1-vCPU host every extra instance costs real speed.
	var runs [][]string
	for _, c := range runner.calls {
		if c.name == "systemd-run" {
			runs = append(runs, c.args)
		}
	}
	if len(runs) != 1 {
		t.Fatalf("systemd-run called %d times, want one MTProxy for every managed port", len(runs))
	}
	got := startedSecrets(runner.calls)
	dedicatedPort := strings.TrimPrefix(a.Backend, "127.0.0.1:")
	ports := []string{"2399", dedicatedPort}
	slices.Sort(ports)
	wantSecrets := []string{second.Secret, a.Secret, b.Secret}
	slices.Sort(wantSecrets)
	if secrets, ok := got[strings.Join(ports, ",")]; !ok || !slices.Equal(secrets, wantSecrets) {
		t.Fatalf("started MTProxy = %v, want ports %v with secrets %v (stock 2398 left to mtproxy.service)", got, ports, wantSecrets)
	}
	if slices.Contains(runs[0], "-M") {
		t.Fatalf("managed MTProxy forks workers: %v", runs[0])
	}
	for _, c := range runner.calls {
		if c.name == "systemd-run" && !strings.Contains(strings.Join(c.args, " "), "--nat-info 10.0.0.5:198.51.100.7 --aes-pwd") {
			t.Fatalf("managed MTProxy lost the installer's NAT args: %v", c.args)
		}
	}
	var firewalled bool
	for _, c := range runner.calls {
		firewalled = firewalled || (c.name == "nft" && len(c.args) == 2 && c.args[0] == "-f")
	}
	if !firewalled {
		t.Fatal("managed MTProxy ports were not firewalled to loopback")
	}
}

func TestReconcileBackendsLeavesMatchingInstanceRunning(t *testing.T) {
	second := RelayProfile{Name: "second", Secret: "ffeeddccbbaa99887766554433221100", Backend: "127.0.0.1:2399"}
	m := seedManager(t, validProfile(), second)
	first := &fakeRunner{}
	m.run = first.run
	useFakeMTProxy(t, m)
	m.ReconcileBackends(context.Background())
	var desc string
	for _, c := range first.calls {
		for _, a := range c.args {
			if v, ok := strings.CutPrefix(a, "--description="); ok {
				desc = v
			}
		}
	}
	running := &fakeRunner{respond: func(name string, args []string) ([]byte, error) {
		if name == "systemctl" && len(args) > 0 && args[0] == "show" {
			return []byte("ActiveState=active\nDescription=" + desc + "\n"), nil
		}
		return nil, nil
	}}
	m.run = running.run
	m.ReconcileBackends(context.Background())
	if got := startedSecrets(running.calls); len(got) != 0 {
		t.Fatalf("an up-to-date backend was restarted: %v", got)
	}
}

func TestSuspendedDedicatedProfileKeepsSecretButLosesItsBackend(t *testing.T) {
	m := seedManager(t, validProfile())
	specs := []DedicatedSpec{{Email: "a@x", Base: "default"}, {Email: "b@x", Base: "default"}}
	if _, err := m.SyncDedicatedProfiles(context.Background(), specs); err != nil {
		t.Fatalf("sync: %v", err)
	}
	before, _ := profileByName(t, m, DedicatedProfileName("a@x"))
	specs[0].Suspended = true
	if _, err := m.SyncDedicatedProfiles(context.Background(), specs); err != nil {
		t.Fatalf("suspend: %v", err)
	}
	runner := &fakeRunner{}
	m.run = runner.run
	useFakeMTProxy(t, m)
	m.ReconcileBackends(context.Background())
	for _, secrets := range startedSecrets(runner.calls) {
		if slices.Contains(secrets, before.Secret) {
			t.Fatalf("a disabled client's secret is still served: %v", secrets)
		}
	}
	specs[0].Suspended = false
	if _, err := m.SyncDedicatedProfiles(context.Background(), specs); err != nil {
		t.Fatalf("resume: %v", err)
	}
	after, _ := profileByName(t, m, DedicatedProfileName("a@x"))
	if after.Secret != before.Secret || !servedBackend(after.Backend) {
		t.Fatalf("re-enabled profile = %+v, want the old secret %s on a served backend", after, before.Secret)
	}
}

// The Overview tab reads backends.managed.length; a null list crashed the page
// on hosts without systemd (no relay installed yet).
func TestStatusAlwaysReportsABackendList(t *testing.T) {
	m, _ := newTestManager(t, &fakeRunner{})
	m.supported = func() bool { return false }
	raw, err := json.Marshal(m.Status(context.Background()).Backends)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), `"managed":[]`) {
		t.Fatalf("backends = %s, want an empty managed list", raw)
	}
}

// Units started by 1.4.3-1.4.6 hold one port each; after the update they must
// be folded into the shared process, not mistaken for hand-run backends.
func TestReconcileBackendsAdoptsPerPortUnitsFromOlderReleases(t *testing.T) {
	second := RelayProfile{Name: "second", Secret: "ffeeddccbbaa99887766554433221100", Backend: "127.0.0.1:2399"}
	third := RelayProfile{Name: "third", Secret: "00112233445566778899aabbccddeeff", Backend: "127.0.0.1:2400"}
	m := seedManager(t, validProfile(), second, third)
	runner := &fakeRunner{respond: func(name string, args []string) ([]byte, error) {
		joined := strings.Join(args, " ")
		switch {
		case name == "systemctl" && strings.HasPrefix(joined, "list-units"):
			return []byte("fullboard-mtproxy-2399.service loaded active running x\nfullboard-mtproxy-2400.service loaded active running x\n"), nil
		case name == "systemctl" && strings.HasPrefix(joined, "show fullboard-mtproxy-2399"):
			return []byte("ActiveState=active\nDescription=FullBoard MTProxy backend 127.0.0.1:2399 stats=4000 fp=old\n"), nil
		case name == "systemctl" && strings.HasPrefix(joined, "show fullboard-mtproxy-2400"):
			return []byte("ActiveState=active\nDescription=FullBoard MTProxy backend 127.0.0.1:2400 stats=4001 fp=old\n"), nil
		}
		return nil, nil
	}}
	m.run = runner.run
	useFakeMTProxy(t, m)
	portBusy = func(int) bool { return true }

	st := m.ReconcileBackends(context.Background())
	for _, row := range st.Managed {
		if row.External {
			t.Fatalf("our own old unit was treated as a hand-run backend: %+v", st.Managed)
		}
	}
	if got := startedSecrets(runner.calls); len(got["2399,2400"]) != 2 {
		t.Fatalf("started = %v, want one MTProxy on 2399,2400", got)
	}
	var stoppedOld bool
	for _, c := range runner.calls {
		stoppedOld = stoppedOld || (c.name == "systemctl" && strings.Join(c.args, " ") == "stop fullboard-mtproxy-2400.service")
	}
	if !stoppedOld {
		t.Fatal("the per-port unit for 2400 was left running next to the shared process")
	}
}
