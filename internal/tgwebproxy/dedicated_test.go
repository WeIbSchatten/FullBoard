package tgwebproxy

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func seedManager(t *testing.T, profiles ...RelayProfile) *Manager {
	t.Helper()
	m, paths := newTestManager(t, &fakeRunner{})
	if err := os.MkdirAll(filepath.Dir(paths.ConfigFile), 0o750); err != nil {
		t.Fatal(err)
	}
	if err := m.store.SaveConfig(context.Background(), testConfig(), &profiles[0]); err != nil {
		t.Fatalf("seed config: %v", err)
	}
	for _, p := range profiles[1:] {
		if _, err := m.AddProfile(context.Background(), p); err != nil {
			t.Fatalf("seed profile %q: %v", p.Name, err)
		}
	}
	return m
}

func profileByName(t *testing.T, m *Manager, name string) (RelayProfile, bool) {
	t.Helper()
	snap, err := m.store.Load()
	if err != nil {
		t.Fatal(err)
	}
	for _, p := range snap.Profiles {
		if p.Name == name {
			return p, true
		}
	}
	return RelayProfile{}, false
}

func TestDedicatedProfileNameFitsRelayNameRule(t *testing.T) {
	short := DedicatedProfileName("Alice@Example.com")
	if short != "fb:alice@example.com" {
		t.Fatalf("short name = %q, want lowercase email under the reserved prefix", short)
	}
	long := DedicatedProfileName(strings.Repeat("a", 120) + "@example.com")
	if len(long) > 64 || !strings.HasPrefix(long, DedicatedPrefix) {
		t.Fatalf("long name = %q (%d bytes), want <=64 bytes under the reserved prefix", long, len(long))
	}
	if long != DedicatedProfileName(strings.Repeat("a", 120)+"@example.com") {
		t.Fatal("long name is not deterministic")
	}
	if long == DedicatedProfileName(strings.Repeat("a", 121)+"@example.com") {
		t.Fatal("distinct long emails collapsed to one profile name")
	}
	if err := validateProfileName(long); err != nil {
		t.Fatalf("derived name rejected by the relay name rule: %v", err)
	}
}

func TestSyncDedicatedCreatesOwnSecretAndKeepsItAcrossSyncs(t *testing.T) {
	base := validProfile()
	base.CarrierMode = "websocket"
	base.Limits = &RelayProfileLimits{MaxSessions: 8}
	m := seedManager(t, base)
	specs := []DedicatedSpec{{Email: "a@x", Base: "default"}, {Email: "b@x", Base: "default"}}

	if _, err := m.SyncDedicatedProfiles(context.Background(), specs); err != nil {
		t.Fatalf("sync: %v", err)
	}
	a, okA := profileByName(t, m, DedicatedProfileName("a@x"))
	b, okB := profileByName(t, m, DedicatedProfileName("b@x"))
	if !okA || !okB {
		t.Fatalf("dedicated profiles missing: a=%v b=%v", okA, okB)
	}
	if a.Secret == base.Secret || b.Secret == base.Secret || a.Secret == b.Secret {
		t.Fatalf("secrets not distinct: base=%s a=%s b=%s", base.Secret, a.Secret, b.Secret)
	}
	if _, err := DecodeSecret(a.Secret); err != nil {
		t.Fatalf("generated secret invalid: %v", err)
	}
	if a.Backend != base.Backend || a.CarrierMode != "websocket" || a.Limits == nil || a.Limits.MaxSessions != 8 {
		t.Fatalf("dedicated profile did not inherit base settings: %+v", a)
	}

	if _, err := m.SyncDedicatedProfiles(context.Background(), specs); err != nil {
		t.Fatalf("second sync: %v", err)
	}
	again, _ := profileByName(t, m, DedicatedProfileName("a@x"))
	if again.Secret != a.Secret {
		t.Fatalf("secret rotated by an idempotent sync: %s -> %s", a.Secret, again.Secret)
	}
}

func TestSyncDedicatedRemovesUnboundAndLeavesUserProfiles(t *testing.T) {
	m := seedManager(t, validProfile(), RelayProfile{Name: "shared", Secret: "ffffffffffffffffffffffffffffffff", Backend: "127.0.0.1:2398"})
	if _, err := m.SyncDedicatedProfiles(context.Background(), []DedicatedSpec{{Email: "a@x", Base: "default"}}); err != nil {
		t.Fatalf("sync: %v", err)
	}
	if _, err := m.SyncDedicatedProfiles(context.Background(), nil); err != nil {
		t.Fatalf("sync after unbind: %v", err)
	}
	if _, ok := profileByName(t, m, DedicatedProfileName("a@x")); ok {
		t.Fatal("dedicated profile survived its binding")
	}
	for _, name := range []string{"default", "shared"} {
		if _, ok := profileByName(t, m, name); !ok {
			t.Fatalf("user profile %q was removed by a sync", name)
		}
	}
}

func TestSyncDedicatedIsNoOpWithoutRelayConfigWhenNothingDesired(t *testing.T) {
	m, _ := newTestManager(t, &fakeRunner{})
	res, err := m.SyncDedicatedProfiles(context.Background(), nil)
	if err != nil || res.Restarted {
		t.Fatalf("sync on a host without a relay = %+v, %v; want a silent no-op", res, err)
	}
}

func TestSyncDedicatedNeedsRelayConfigWhenSomethingDesired(t *testing.T) {
	m, _ := newTestManager(t, &fakeRunner{})
	_, err := m.SyncDedicatedProfiles(context.Background(), []DedicatedSpec{{Email: "a@x", Base: "default"}})
	if err == nil || !strings.Contains(err.Error(), "config.json does not exist") {
		t.Fatalf("error = %v, want the missing-config refusal", err)
	}
}

func TestSyncDedicatedHonoursSecretAndBackendOverrides(t *testing.T) {
	m := seedManager(t, validProfile())
	const secret = "aabbccddeeff00112233445566778899"
	const backend = "127.0.0.1:46111"
	if _, err := m.SyncDedicatedProfiles(context.Background(), []DedicatedSpec{{
		Email: "a@x", Base: "default", Secret: secret, Backend: backend,
	}}); err != nil {
		t.Fatalf("sync: %v", err)
	}
	got, ok := profileByName(t, m, DedicatedProfileName("a@x"))
	if !ok {
		t.Fatal("dedicated profile missing")
	}
	if got.Secret != secret || got.Backend != backend {
		t.Fatalf("profile = %+v, want secret=%s backend=%s", got, secret, backend)
	}
	if _, err := m.SyncDedicatedProfiles(context.Background(), []DedicatedSpec{{
		Email: "a@x", Base: "default", Secret: secret, Backend: backend,
	}}); err != nil {
		t.Fatalf("second sync: %v", err)
	}
	again, _ := profileByName(t, m, DedicatedProfileName("a@x"))
	if again.Secret != secret || again.Backend != backend {
		t.Fatalf("override not stable across sync: %+v", again)
	}
}

func TestSyncDedicatedReportsMissingBaseButAppliesTheRest(t *testing.T) {
	m := seedManager(t, validProfile())
	_, err := m.SyncDedicatedProfiles(context.Background(), []DedicatedSpec{
		{Email: "a@x", Base: "default"},
		{Email: "b@x", Base: "gone"},
	})
	if err == nil || !strings.Contains(err.Error(), `"gone"`) || !strings.Contains(err.Error(), "b@x") {
		t.Fatalf("error = %v, want the missing base profile named", err)
	}
	if _, ok := profileByName(t, m, DedicatedProfileName("a@x")); !ok {
		t.Fatal("a healthy binding was not applied because another binding's base is missing")
	}
	if _, ok := profileByName(t, m, DedicatedProfileName("b@x")); ok {
		t.Fatal("a profile was created from a missing base")
	}
}

func TestManagedProfilesAreProtectedFromManualEdits(t *testing.T) {
	m := seedManager(t, validProfile())
	if _, err := m.SyncDedicatedProfiles(context.Background(), []DedicatedSpec{{Email: "a@x", Base: "default"}}); err != nil {
		t.Fatal(err)
	}
	managed := DedicatedProfileName("a@x")
	p := validProfile()

	p.Name = DedicatedPrefix + "manual"
	if _, err := m.AddProfile(context.Background(), p); err == nil || !strings.Contains(err.Error(), "reserved") {
		t.Fatalf("AddProfile error = %v, want a reserved-prefix refusal", err)
	}
	p.Name = "renamed"
	if _, err := m.UpdateProfile(context.Background(), managed, p); err == nil || !strings.Contains(err.Error(), "managed") {
		t.Fatalf("UpdateProfile error = %v, want a managed-profile refusal", err)
	}
	if _, err := m.DeleteProfile(context.Background(), managed); err == nil || !strings.Contains(err.Error(), "managed") {
		t.Fatalf("DeleteProfile error = %v, want a managed-profile refusal", err)
	}
}
