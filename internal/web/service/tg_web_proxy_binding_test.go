package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/WeIbSchatten/FullBoard/v3/internal/database"
	"github.com/WeIbSchatten/FullBoard/v3/internal/database/model"
	"github.com/WeIbSchatten/FullBoard/v3/internal/tgwebproxy"
	"github.com/WeIbSchatten/FullBoard/v3/internal/tgwebproxy/relaytest"
)

const bindingBaseSecret = "000102030405060708090a0b0c0d0e0f"

func setupBindingTest(t *testing.T) *tgwebproxy.Manager {
	t.Helper()
	setupBulkDB(t)
	m := relaytest.New(t, "proxy.example.com", tgwebproxy.RelayProfile{
		Name: "default", Secret: bindingBaseSecret, Backend: "127.0.0.1:2398",
	})
	t.Cleanup(UseTgWebProxyManager(m))
	return m
}

func createBindingClient(t *testing.T, email, subID string, enable bool) model.ClientRecord {
	t.Helper()
	rec := model.ClientRecord{Email: email, SubID: subID, UUID: "uuid-" + email, Enable: enable}
	if err := database.GetDB().Create(&rec).Error; err != nil {
		t.Fatalf("create client %s: %v", email, err)
	}
	if !enable {
		if err := database.GetDB().Model(&rec).Update("enable", false).Error; err != nil {
			t.Fatalf("disable client %s: %v", email, err)
		}
	}
	return rec
}

func relayProfile(t *testing.T, m *tgwebproxy.Manager, name string) (tgwebproxy.RelayProfile, bool) {
	t.Helper()
	snap, err := m.Store().Load()
	if err != nil {
		t.Fatal(err)
	}
	for _, p := range snap.Profiles {
		if p.Name == name {
			return p, true
		}
	}
	return tgwebproxy.RelayProfile{}, false
}

func TestBindDedicatedGivesTheClientItsOwnProfileSecret(t *testing.T) {
	m := setupBindingTest(t)
	createBindingClient(t, "alice", "sub-a", true)
	createBindingClient(t, "bob", "sub-b", true)
	svc := &TgWebProxyService{}

	if _, err := svc.BindClient(TgWebProxyBindRequest{Email: "alice", ProfileName: "default", Dedicated: true}); err != nil {
		t.Fatalf("bind alice: %v", err)
	}
	if _, err := svc.BindClient(TgWebProxyBindRequest{Email: "bob", ProfileName: "default", Dedicated: true}); err != nil {
		t.Fatalf("bind bob: %v", err)
	}
	if _, err := svc.SyncBindings(context.Background()); err != nil {
		t.Fatalf("sync: %v", err)
	}

	alice, okA := relayProfile(t, m, tgwebproxy.DedicatedProfileName("alice"))
	bob, okB := relayProfile(t, m, tgwebproxy.DedicatedProfileName("bob"))
	if !okA || !okB {
		t.Fatalf("dedicated profiles missing: alice=%v bob=%v", okA, okB)
	}
	if alice.Secret == bindingBaseSecret || alice.Secret == bob.Secret {
		t.Fatalf("secrets not unique: base=%s alice=%s bob=%s", bindingBaseSecret, alice.Secret, bob.Secret)
	}
}

func TestClientLinksUseSharedOrDedicatedSecretAndSkipDisabled(t *testing.T) {
	m := setupBindingTest(t)
	createBindingClient(t, "shared", "sub-1", true)
	createBindingClient(t, "own", "sub-1", true)
	createBindingClient(t, "off", "sub-1", false)
	createBindingClient(t, "unbound", "sub-1", true)
	createBindingClient(t, "other-sub", "sub-2", true)
	svc := &TgWebProxyService{}
	for _, req := range []TgWebProxyBindRequest{
		{Email: "shared", ProfileName: "default"},
		{Email: "own", ProfileName: "default", Dedicated: true},
		{Email: "off", ProfileName: "default"},
		{Email: "other-sub", ProfileName: "default"},
	} {
		if _, err := svc.BindClient(req); err != nil {
			t.Fatalf("bind %s: %v", req.Email, err)
		}
	}

	links, err := svc.ClientLinksBySubId("sub-1")
	if err != nil {
		t.Fatalf("links: %v", err)
	}
	if len(links) != 1 || links[0].Email != "shared" {
		t.Fatalf("before sync links = %+v, want only the shared binding (dedicated profile not created yet, disabled client skipped)", links)
	}
	wantShared := "https://t.me/webproxy?server=proxy.example.com&secret=" + bindingBaseSecret
	if links[0].Link != wantShared {
		t.Fatalf("shared link = %q, want %q", links[0].Link, wantShared)
	}

	if _, err := svc.SyncBindings(context.Background()); err != nil {
		t.Fatalf("sync: %v", err)
	}
	own, _ := relayProfile(t, m, tgwebproxy.DedicatedProfileName("own"))
	links, err = svc.ClientLinksBySubId("sub-1")
	if err != nil {
		t.Fatalf("links: %v", err)
	}
	got := map[string]string{}
	for _, l := range links {
		got[l.Email] = l.Link
	}
	if len(got) != 2 || got["shared"] != wantShared {
		t.Fatalf("after sync links = %v, want shared+own", got)
	}
	if want := "secret=" + own.Secret; !strings.HasSuffix(got["own"], want) {
		t.Fatalf("dedicated link = %q, want it to carry the client's own secret (%s)", got["own"], want)
	}
}

func TestBindClientRejectsUnknownClientAndProfile(t *testing.T) {
	setupBindingTest(t)
	createBindingClient(t, "alice", "sub-a", true)
	svc := &TgWebProxyService{}

	if _, err := svc.BindClient(TgWebProxyBindRequest{Email: "nobody", ProfileName: "default"}); err == nil || !strings.Contains(err.Error(), "nobody") {
		t.Fatalf("unknown client error = %v, want the email named", err)
	}
	if _, err := svc.BindClient(TgWebProxyBindRequest{Email: "alice", ProfileName: "missing"}); err == nil || !strings.Contains(err.Error(), `"missing"`) {
		t.Fatalf("unknown profile error = %v, want the profile named", err)
	}
	if _, err := svc.BindClient(TgWebProxyBindRequest{Email: "alice", ProfileName: tgwebproxy.DedicatedProfileName("bob")}); err == nil {
		t.Fatal("binding to a managed per-client profile was accepted")
	}
}

func TestBindClientReplacesExistingBinding(t *testing.T) {
	setupBindingTest(t)
	createBindingClient(t, "alice", "sub-a", true)
	svc := &TgWebProxyService{}
	if _, err := svc.BindClient(TgWebProxyBindRequest{Email: "alice", ProfileName: "default"}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.BindClient(TgWebProxyBindRequest{Email: "alice", ProfileName: "default", Dedicated: true}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.SyncBindings(context.Background()); err != nil {
		t.Fatal(err)
	}
	list, err := svc.ListBindings()
	if err != nil {
		t.Fatal(err)
	}
	if len(list.Bindings) != 1 || !list.Bindings[0].Dedicated || list.Bindings[0].EffectiveProfile != tgwebproxy.DedicatedProfileName("alice") {
		t.Fatalf("bindings = %+v, want one dedicated binding", list.Bindings)
	}
	if list.Bindings[0].Secret == "" || list.Bindings[0].Link == "" {
		t.Fatalf("bindings should expose live secret/link, got %+v", list.Bindings[0])
	}
	if list.Bindings[0].Secret == bindingBaseSecret {
		t.Fatalf("dedicated binding must not reuse the shared secret: %q", list.Bindings[0].Secret)
	}
}

func TestUnbindThenSyncRemovesDedicatedProfile(t *testing.T) {
	m := setupBindingTest(t)
	createBindingClient(t, "alice", "sub-a", true)
	svc := &TgWebProxyService{}
	if _, err := svc.BindClient(TgWebProxyBindRequest{Email: "alice", ProfileName: "default", Dedicated: true}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.SyncBindings(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := svc.UnbindClient("alice"); err != nil {
		t.Fatalf("unbind: %v", err)
	}
	if _, err := svc.SyncBindings(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, ok := relayProfile(t, m, tgwebproxy.DedicatedProfileName("alice")); ok {
		t.Fatal("dedicated profile survived unbind")
	}
	links, err := svc.ClientLinksBySubId("sub-a")
	if err != nil || len(links) != 0 {
		t.Fatalf("links after unbind = %+v, %v; want none", links, err)
	}
}

func TestSyncDropsBindingsOfDeletedClients(t *testing.T) {
	m := setupBindingTest(t)
	rec := createBindingClient(t, "alice", "sub-a", true)
	svc := &TgWebProxyService{}
	if _, err := svc.BindClient(TgWebProxyBindRequest{Email: "alice", ProfileName: "default", Dedicated: true}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.SyncBindings(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := database.GetDB().Delete(&model.ClientRecord{}, rec.Id).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := svc.SyncBindings(context.Background()); err != nil {
		t.Fatalf("sync: %v", err)
	}
	if _, ok := relayProfile(t, m, tgwebproxy.DedicatedProfileName("alice")); ok {
		t.Fatal("dedicated profile of a deleted client survived")
	}
	var n int64
	database.GetDB().Model(&model.ClientTgWebProxy{}).Count(&n)
	if n != 0 {
		t.Fatalf("%d orphan binding rows left behind", n)
	}
}

func TestProfileInUseCannotBeDeletedOrRenamed(t *testing.T) {
	setupBindingTest(t)
	createBindingClient(t, "alice", "sub-a", true)
	svc := &TgWebProxyService{}
	if _, err := svc.BindClient(TgWebProxyBindRequest{Email: "alice", ProfileName: "default"}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.DeleteProfile(context.Background(), "default"); err == nil || !strings.Contains(err.Error(), "bound") {
		t.Fatalf("DeleteProfile error = %v, want a bound-client refusal", err)
	}
	renamed := tgwebproxy.RelayProfile{Name: "renamed", Secret: bindingBaseSecret, Backend: "127.0.0.1:2398"}
	if _, err := svc.UpdateProfile(context.Background(), "default", renamed); err == nil || !strings.Contains(err.Error(), "bound") {
		t.Fatalf("UpdateProfile rename error = %v, want a bound-client refusal", err)
	}
}

func TestBindingChangesAreSyncedAfterDebounce(t *testing.T) {
	m := setupBindingTest(t)
	for _, email := range []string{"a", "b", "c"} {
		createBindingClient(t, email, "sub-"+email, true)
	}
	prev := tgWebProxySyncDelay
	tgWebProxySyncDelay = 20 * time.Millisecond
	t.Cleanup(func() { tgWebProxySyncDelay = prev })

	svc := &TgWebProxyService{}
	for _, email := range []string{"a", "b", "c"} {
		if _, err := svc.BindClient(TgWebProxyBindRequest{Email: email, ProfileName: "default", Dedicated: true}); err != nil {
			t.Fatal(err)
		}
	}
	deadline := time.Now().Add(5 * time.Second)
	for {
		_, okA := relayProfile(t, m, tgwebproxy.DedicatedProfileName("a"))
		_, okB := relayProfile(t, m, tgwebproxy.DedicatedProfileName("b"))
		_, okC := relayProfile(t, m, tgwebproxy.DedicatedProfileName("c"))
		if okA && okB && okC {
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("debounced sync never created the profiles: a=%v b=%v c=%v", okA, okB, okC)
		}
		time.Sleep(20 * time.Millisecond)
	}
}
