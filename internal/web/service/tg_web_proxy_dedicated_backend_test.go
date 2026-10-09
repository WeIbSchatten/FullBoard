package service

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/WeIbSchatten/FullBoard/v3/internal/database"
	"github.com/WeIbSchatten/FullBoard/v3/internal/database/dbtest"
	"github.com/WeIbSchatten/FullBoard/v3/internal/database/model"
	"github.com/WeIbSchatten/FullBoard/v3/internal/tgwebproxy"
	"github.com/WeIbSchatten/FullBoard/v3/internal/tgwebproxy/relaytest"
)

func TestEnsureTgWebProxyManagedBackendCreatesAndReuses(t *testing.T) {
	dbtest.InitDB(t, filepath.Join(t.TempDir(), "fullboard.db"))
	inboundSvc := &InboundService{}
	const email = "alice@wp"
	const secret = "aabbccddeeff00112233445566778899"
	if err := database.GetDB().Create(&model.ClientRecord{Email: email, SubID: "subalice", Enable: true}).Error; err != nil {
		t.Fatalf("seed client: %v", err)
	}

	backend, err := ensureTgWebProxyManagedBackend(inboundSvc, email, secret)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if !strings.HasPrefix(backend, "127.0.0.1:") {
		t.Fatalf("backend = %q, want loopback", backend)
	}

	var ib model.Inbound
	if err := database.GetDB().Where("remark = ?", tgWebProxyManagedRemark(email)).First(&ib).Error; err != nil {
		t.Fatalf("lookup inbound: %v", err)
	}
	if ib.Listen != "127.0.0.1" || ib.Protocol != model.MTProto {
		t.Fatalf("inbound = %+v, want loopback MTProto", ib)
	}
	if strings.Contains(ib.Settings, "fakeTlsDomain") {
		t.Fatalf("managed inbound must not set fakeTlsDomain: %s", ib.Settings)
	}
	if !strings.Contains(ib.Settings, secret) {
		t.Fatalf("settings missing secret: %s", ib.Settings)
	}
	var rec model.ClientRecord
	if err := database.GetDB().Where("email = ?", email).First(&rec).Error; err != nil {
		t.Fatalf("reload client: %v", err)
	}
	if rec.SubID != "subalice" {
		t.Fatalf("SubID cleared by managed sync: got %q, want subalice", rec.SubID)
	}

	again, err := ensureTgWebProxyManagedBackend(inboundSvc, email, secret)
	if err != nil {
		t.Fatalf("reuse: %v", err)
	}
	if again != backend {
		t.Fatalf("reuse backend = %q, want %q", again, backend)
	}
	var count int64
	if err := database.GetDB().Model(&model.Inbound{}).Where("remark = ?", tgWebProxyManagedRemark(email)).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("inbound count = %d, want 1", count)
	}
}

func TestPrepareDedicatedSpecsPointsAtManagedBackend(t *testing.T) {
	dbtest.InitDB(t, filepath.Join(t.TempDir(), "fullboard.db"))
	m := relaytest.New(t, "proxy.example.com", tgwebproxy.RelayProfile{
		Name: "default", Secret: "000102030405060708090a0b0c0d0e0f", Backend: "127.0.0.1:2398",
	})
	t.Cleanup(UseTgWebProxyManager(m))

	rec := &model.ClientRecord{Email: "bob@wp", SubID: "subbob", Enable: true}
	if err := database.GetDB().Create(rec).Error; err != nil {
		t.Fatal(err)
	}
	rows := []tgBindingRow{{ClientId: rec.Id, Email: rec.Email, ProfileName: "default", Dedicated: true}}
	specs, err := (&TgWebProxyService{}).prepareDedicatedSpecs(rows)
	if err != nil {
		t.Fatalf("prepare: %v", err)
	}
	if len(specs) != 1 {
		t.Fatalf("specs = %d, want 1", len(specs))
	}
	if specs[0].Secret == "" || !strings.HasPrefix(specs[0].Backend, "127.0.0.1:") {
		t.Fatalf("spec = %+v, want secret + loopback backend", specs[0])
	}
	if specs[0].Backend == "127.0.0.1:2398" {
		t.Fatal("dedicated backend must not stay on the shared base port")
	}
}

func TestCleanupManagedBackendsRemovesUnwanted(t *testing.T) {
	dbtest.InitDB(t, filepath.Join(t.TempDir(), "fullboard.db"))
	inboundSvc := &InboundService{}
	if err := database.GetDB().Create(&model.ClientRecord{Email: "gone@wp", SubID: "subgone", Enable: true}).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := ensureTgWebProxyManagedBackend(inboundSvc, "gone@wp", "aabbccddeeff00112233445566778899"); err != nil {
		t.Fatal(err)
	}
	(&TgWebProxyService{}).cleanupManagedBackends(map[string]struct{}{})
	var count int64
	if err := database.GetDB().Model(&model.Inbound{}).Where("remark LIKE ?", tgWebProxyManagedRemarkPrefix+"%").Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("managed inbounds left = %d, want 0", count)
	}
}
