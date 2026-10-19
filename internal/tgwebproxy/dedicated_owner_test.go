package tgwebproxy

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"
)

const remoteA = "remote:1"

func syncAs(t *testing.T, m *Manager, owner string, emails ...string) {
	t.Helper()
	specs := make([]DedicatedSpec, len(emails))
	for i, e := range emails {
		specs[i] = DedicatedSpec{Email: e, Base: "default"}
	}
	if _, err := m.SyncDedicatedProfiles(context.Background(), owner, specs); err != nil {
		t.Fatalf("sync as %s: %v", owner, err)
	}
}

func profilesOnDisk(t *testing.T, m *Manager) string {
	t.Helper()
	raw, err := os.ReadFile(m.store.Paths().ProfilesFile)
	if err != nil {
		t.Fatal(err)
	}
	return string(raw)
}

func forgetDedicatedOwners(t *testing.T, m *Manager) {
	t.Helper()
	if err := os.Remove(dedicatedOwnersPath(m.store.Paths())); err != nil {
		t.Fatal(err)
	}
}

func withDedicatedClock(t *testing.T, at time.Time) {
	t.Helper()
	prev := dedicatedNow
	dedicatedNow = func() time.Time { return at }
	t.Cleanup(func() { dedicatedNow = prev })
}

// A relay host's own panel and a master that manages it remotely both sync every
// minute; each used to delete the other's profiles and restart the relay.
func TestDedicatedOwnersDoNotRemoveEachOthersProfiles(t *testing.T) {
	m := seedManager(t, validProfile())
	syncAs(t, m, LocalDedicatedOwner, "local@x")
	syncAs(t, m, remoteA, "remote@x")
	remote, _ := profileByName(t, m, DedicatedProfileName("remote@x"))

	settled := profilesOnDisk(t, m)
	for range 3 {
		for _, owner := range []string{LocalDedicatedOwner, remoteA} {
			email := map[string]string{LocalDedicatedOwner: "local@x", remoteA: "remote@x"}[owner]
			syncAs(t, m, owner, email)
			if got := profilesOnDisk(t, m); got != settled {
				t.Fatalf("sync as %s rewrote profiles.json (and so restarted the relay):\n%s\nwant\n%s", owner, got, settled)
			}
		}
	}
	again, ok := profileByName(t, m, DedicatedProfileName("remote@x"))
	if !ok || again.Secret != remote.Secret {
		t.Fatalf("remote profile = %+v (present %v), want it kept with secret %s", again, ok, remote.Secret)
	}

	syncAs(t, m, remoteA)
	if _, ok := profileByName(t, m, DedicatedProfileName("remote@x")); ok {
		t.Fatal("remote owner could not remove its own unbound profile")
	}
	if _, ok := profileByName(t, m, DedicatedProfileName("local@x")); !ok {
		t.Fatal("remote owner removed a profile the local panel owns")
	}
}

func TestDedicatedOwnerClaimsLegacyProfileKeepingItsSecret(t *testing.T) {
	m := seedManager(t, validProfile())
	syncAs(t, m, LocalDedicatedOwner, "legacy@x")
	legacy, _ := profileByName(t, m, DedicatedProfileName("legacy@x"))
	forgetDedicatedOwners(t, m)

	syncAs(t, m, LocalDedicatedOwner)
	if _, ok := profileByName(t, m, DedicatedProfileName("legacy@x")); !ok {
		t.Fatal("an unowned pre-upgrade profile was deleted before its owner could claim it")
	}
	syncAs(t, m, remoteA, "legacy@x")
	claimed, _ := profileByName(t, m, DedicatedProfileName("legacy@x"))
	if claimed.Secret != legacy.Secret {
		t.Fatalf("claimed profile secret = %s, want the existing %s so client links keep working", claimed.Secret, legacy.Secret)
	}
	syncAs(t, m, LocalDedicatedOwner)
	if _, ok := profileByName(t, m, DedicatedProfileName("legacy@x")); !ok {
		t.Fatal("local sync removed a profile the remote owner claimed")
	}
}

func TestUnclaimedLegacyProfileIsRemovedAfterGrace(t *testing.T) {
	m := seedManager(t, validProfile())
	start := time.Unix(1_800_000_000, 0)
	withDedicatedClock(t, start)
	syncAs(t, m, LocalDedicatedOwner, "stale@x")
	forgetDedicatedOwners(t, m)

	syncAs(t, m, LocalDedicatedOwner)
	withDedicatedClock(t, start.Add(dedicatedOwnerGrace-time.Second))
	syncAs(t, m, LocalDedicatedOwner)
	if _, ok := profileByName(t, m, DedicatedProfileName("stale@x")); !ok {
		t.Fatal("unclaimed profile removed before the grace period ended")
	}
	withDedicatedClock(t, start.Add(dedicatedOwnerGrace+time.Second))
	syncAs(t, m, LocalDedicatedOwner)
	if _, ok := profileByName(t, m, DedicatedProfileName("stale@x")); ok {
		t.Fatal("unclaimed profile survived the grace period")
	}
}

func TestDedicatedOwnerConflictLeavesTheOwnersProfileAlone(t *testing.T) {
	m := seedManager(t, validProfile())
	syncAs(t, m, LocalDedicatedOwner, "both@x")
	owned, _ := profileByName(t, m, DedicatedProfileName("both@x"))

	_, err := m.SyncDedicatedProfiles(context.Background(), remoteA, []DedicatedSpec{{Email: "both@x", Base: "default", Secret: "aabbccddeeff00112233445566778899"}})
	if err == nil || !strings.Contains(err.Error(), "both@x") {
		t.Fatalf("error = %v, want a conflict naming both@x", err)
	}
	got, _ := profileByName(t, m, DedicatedProfileName("both@x"))
	if got.Secret != owned.Secret {
		t.Fatalf("conflicting owner rewrote the profile: %s -> %s", owned.Secret, got.Secret)
	}
}

func TestStaleRemoteOwnerIsTakenOver(t *testing.T) {
	m := seedManager(t, validProfile())
	start := time.Unix(1_800_000_000, 0)
	withDedicatedClock(t, start)
	syncAs(t, m, remoteA, "moved@x")
	before, _ := profileByName(t, m, DedicatedProfileName("moved@x"))

	withDedicatedClock(t, start.Add(time.Minute))
	if _, err := m.SyncDedicatedProfiles(context.Background(), "remote:2", []DedicatedSpec{{Email: "moved@x", Base: "default"}}); err == nil {
		t.Fatal("a second master took over a profile whose owner is still syncing")
	}
	withDedicatedClock(t, start.Add(dedicatedOwnerGrace+time.Minute))
	syncAs(t, m, "remote:2", "moved@x")
	after, _ := profileByName(t, m, DedicatedProfileName("moved@x"))
	if after.Secret != before.Secret {
		t.Fatalf("takeover changed the secret: %s -> %s", before.Secret, after.Secret)
	}
	withDedicatedClock(t, start.Add(dedicatedOwnerGrace+2*time.Minute))
	syncAs(t, m, remoteA)
	if _, ok := profileByName(t, m, DedicatedProfileName("moved@x")); !ok {
		t.Fatal("the previous owner removed a profile it no longer owns")
	}
}
