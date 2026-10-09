package sub

import (
	"net/url"
	"strings"
	"testing"

	"github.com/WeIbSchatten/FullBoard/v3/internal/database"
	"github.com/WeIbSchatten/FullBoard/v3/internal/database/model"
	"github.com/WeIbSchatten/FullBoard/v3/internal/tgwebproxy"
	"github.com/WeIbSchatten/FullBoard/v3/internal/tgwebproxy/relaytest"
	"github.com/WeIbSchatten/FullBoard/v3/internal/web/service"
)

const webProxyTestSecret = "000102030405060708090a0b0c0d0e0f"

func useTestRelay(t *testing.T) {
	t.Helper()
	m := relaytest.New(t, "proxy.example.com", tgwebproxy.RelayProfile{
		Name: "default", Secret: webProxyTestSecret, Backend: "127.0.0.1:2398",
	})
	t.Cleanup(service.UseTgWebProxyManager(m))
}

func bindClientToProfile(t *testing.T, clientID int, profile string, dedicated bool) {
	t.Helper()
	row := model.ClientTgWebProxy{ClientId: clientID, ProfileName: profile, Dedicated: dedicated}
	if err := database.GetDB().Create(&row).Error; err != nil {
		t.Fatalf("bind client %d: %v", clientID, err)
	}
}

func TestGetSubsAppendsWebProxyLinkForBoundClient(t *testing.T) {
	initSubDB(t)
	useTestRelay(t)
	db := database.GetDB()

	in := &model.Inbound{
		Port:     8443,
		Protocol: model.MTProto,
		Enable:   true,
		Tag:      "mt-webproxy",
		Settings: `{"fakeTlsDomain":"www.cloudflare.com","clients":[{"email":"u@mt","enable":true,"subId":"subwp","secret":"` + mtprotoTestSecret + `"}]}`,
	}
	if err := db.Create(in).Error; err != nil {
		t.Fatalf("create inbound: %v", err)
	}
	rec := &model.ClientRecord{Email: "u@mt", SubID: "subwp", Enable: true, Secret: mtprotoTestSecret}
	if err := db.Create(rec).Error; err != nil {
		t.Fatalf("create client: %v", err)
	}
	if err := db.Create(&model.ClientInbound{ClientId: rec.Id, InboundId: in.Id}).Error; err != nil {
		t.Fatalf("attach client: %v", err)
	}
	bindClientToProfile(t, rec.Id, "default", false)

	links, emails, _, _, err := NewSubService("").GetSubs("subwp", "sub.example.com")
	if err != nil {
		t.Fatalf("GetSubs: %v", err)
	}
	if len(links) != 2 || len(emails) != 2 {
		t.Fatalf("links=%v emails=%v, want the mtproto link plus one web-proxy link", links, emails)
	}
	if !strings.HasPrefix(links[0], "tg://proxy") {
		t.Fatalf("first link = %q, want the inbound's link first", links[0])
	}
	u, err := url.Parse(links[1])
	if err != nil {
		t.Fatalf("parse web-proxy link: %v", err)
	}
	if u.Host != "t.me" || u.Path != "/webproxy" || u.Query().Get("server") != "proxy.example.com" || u.Query().Get("secret") != webProxyTestSecret {
		t.Fatalf("web-proxy link = %q, want https://t.me/webproxy for the shared profile", links[1])
	}
	if emails[1] != "u@mt" {
		t.Fatalf("web-proxy link attributed to %q, want u@mt", emails[1])
	}
}

func TestGetSubsEmitsWebProxyLinkForClientWithoutInbounds(t *testing.T) {
	initSubDB(t)
	useTestRelay(t)
	rec := &model.ClientRecord{Email: "solo@wp", SubID: "subsolo", Enable: true}
	if err := database.GetDB().Create(rec).Error; err != nil {
		t.Fatalf("create client: %v", err)
	}
	bindClientToProfile(t, rec.Id, "default", false)

	links, emails, _, traffic, err := NewSubService("").GetSubs("subsolo", "sub.example.com")
	if err != nil {
		t.Fatalf("GetSubs: %v", err)
	}
	if len(links) != 1 || !strings.HasPrefix(links[0], "https://t.me/webproxy?") {
		t.Fatalf("links = %v, want exactly the web-proxy link", links)
	}
	if len(emails) != 1 || emails[0] != "solo@wp" {
		t.Fatalf("emails = %v, want solo@wp", emails)
	}
	if !traffic.Enable {
		t.Fatal("subscription of an enabled bound client reported as disabled")
	}
}

func TestGetSubsOmitsWebProxyLinkForUnboundClient(t *testing.T) {
	initSubDB(t)
	useTestRelay(t)
	rec := &model.ClientRecord{Email: "plain@wp", SubID: "subplain", Enable: true}
	if err := database.GetDB().Create(rec).Error; err != nil {
		t.Fatalf("create client: %v", err)
	}

	links, _, _, _, err := NewSubService("").GetSubs("subplain", "sub.example.com")
	if err != nil {
		t.Fatalf("GetSubs: %v", err)
	}
	if len(links) != 0 {
		t.Fatalf("links = %v, want none for a client without a binding", links)
	}
}
