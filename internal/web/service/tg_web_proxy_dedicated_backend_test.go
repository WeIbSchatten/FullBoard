package service

import (
	"context"
	"testing"

	"github.com/WeIbSchatten/We1ssBoard/v3/internal/database"
	"github.com/WeIbSchatten/We1ssBoard/v3/internal/database/model"
	"github.com/WeIbSchatten/We1ssBoard/v3/internal/tgwebproxy"
)

// mtg rejects the relay's plain 16-byte secrets ("incorrect first byte of
// secret"), so the old fb-tgwp inbounds only crash-looped and must go.
func TestSyncRemovesLegacyMtgDedicatedInbounds(t *testing.T) {
	setupBindingTest(t)
	createBindingClient(t, "alice", "sub-a", true)
	if _, _, err := (&InboundService{}).AddInbound(&model.Inbound{
		UserId: 1, Remark: tgWebProxyManagedRemarkPrefix + "alice", Enable: true,
		Listen: "127.0.0.1", Port: 45791, Protocol: model.MTProto, Settings: `{"clients":[]}`,
	}); err != nil {
		t.Fatalf("seed legacy inbound: %v", err)
	}
	svc := &TgWebProxyService{}
	if _, err := svc.BindClient(TgWebProxyBindRequest{Email: "alice", ProfileName: "default", Dedicated: true}); err != nil {
		t.Fatalf("bind: %v", err)
	}
	if _, err := svc.SyncBindings(context.Background()); err != nil {
		t.Fatalf("sync: %v", err)
	}
	var count int64
	if err := database.GetDB().Model(&model.Inbound{}).Where("remark LIKE ?", tgWebProxyManagedRemarkPrefix+"%").Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("legacy mtg inbounds left = %d, want 0", count)
	}
}

func TestDedicatedBindingLeavesTheStockMTProxyPort(t *testing.T) {
	m := setupBindingTest(t)
	createBindingClient(t, "bob", "sub-b", true)
	svc := &TgWebProxyService{}
	if _, err := svc.BindClient(TgWebProxyBindRequest{Email: "bob", ProfileName: "default", Dedicated: true}); err != nil {
		t.Fatalf("bind: %v", err)
	}
	if _, err := svc.SyncBindings(context.Background()); err != nil {
		t.Fatalf("sync: %v", err)
	}
	p, ok := relayProfile(t, m, tgwebproxy.DedicatedProfileName("bob"))
	if !ok {
		t.Fatal("dedicated profile missing")
	}
	if p.Backend == "127.0.0.1:2398" || p.Backend == tgwebproxy.SuspendedBackend {
		t.Fatalf("dedicated backend = %s, want a panel-run MTProxy port (2398 only knows the shared secret)", p.Backend)
	}
}
