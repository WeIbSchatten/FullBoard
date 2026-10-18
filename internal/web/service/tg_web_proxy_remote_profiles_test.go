package service

import (
	"context"
	"strings"
	"testing"

	"github.com/WeIbSchatten/We1ssBoard/v3/internal/database"
	"github.com/WeIbSchatten/We1ssBoard/v3/internal/database/model"
	"github.com/WeIbSchatten/We1ssBoard/v3/internal/tgwebproxy"
)

func bindRemoteRow(t *testing.T, rec model.ClientRecord, nodeID int, profile string) {
	t.Helper()
	row := model.ClientTgWebProxy{ClientId: rec.Id, ProfileName: profile, Dedicated: true, NodeId: &nodeID}
	if err := database.GetDB().Create(&row).Error; err != nil {
		t.Fatal(err)
	}
}

// A node's "default" profile and the master's own "default" are different relays;
// a client bound to the node's one must not pin the local profile.
func TestRemoteBindingDoesNotBlockLocalProfileDelete(t *testing.T) {
	m := setupBindingTest(t)
	bindRemoteRow(t, createBindingClient(t, "eu-client", "sub-eu", true), 7, "default")
	spare := tgwebproxy.RelayProfile{Name: "spare", Secret: "ffeeddccbbaa99887766554433221100", Backend: "127.0.0.1:2399"}
	if _, err := (&TgWebProxyService{}).AddProfile(context.Background(), spare); err != nil {
		t.Fatal(err)
	}

	if _, err := (&TgWebProxyService{}).DeleteProfile(context.Background(), "default"); err != nil {
		t.Fatalf("DeleteProfile = %v, want the unbound local profile deleted", err)
	}
	if _, ok := relayProfile(t, m, "default"); ok {
		t.Fatal("local profile still present")
	}
}

// Deleting or renaming a node profile that master clients use would silently drop
// web-proxy from their subscriptions.
func TestRemoteProfileInUseCannotBeDeletedOrRenamed(t *testing.T) {
	setupBindingTest(t)
	bindRemoteRow(t, createBindingClient(t, "eu-client", "sub-eu", true), 7, "eu")
	nodes := &NodeService{}

	if _, err := nodes.DeleteRemoteTgWebProxyProfile(7, "eu"); err == nil || !strings.Contains(err.Error(), "bound") {
		t.Fatalf("DeleteRemoteTgWebProxyProfile = %v, want a bound-client refusal", err)
	}
	renamed := relayProfileNamed("eu-2")
	if _, err := nodes.UpdateRemoteTgWebProxyProfile(7, "eu", renamed); err == nil || !strings.Contains(err.Error(), "bound") {
		t.Fatalf("UpdateRemoteTgWebProxyProfile rename = %v, want a bound-client refusal", err)
	}
}

func TestBindClientsBindsAllOrNone(t *testing.T) {
	setupBindingTest(t)
	createBindingClient(t, "alice", "sub-a", true)
	createBindingClient(t, "bob", "sub-b", true)
	svc := &TgWebProxyService{}

	_, err := svc.BindClients(TgWebProxyBindManyRequest{Emails: []string{"alice", "nobody"}, ProfileName: "default"})
	if err == nil || !strings.Contains(err.Error(), "nobody") {
		t.Fatalf("BindClients with unknown email = %v, want it named", err)
	}
	var n int64
	database.GetDB().Model(&model.ClientTgWebProxy{}).Count(&n)
	if n != 0 {
		t.Fatalf("%d bindings created by a rejected batch, want 0", n)
	}

	got, err := svc.BindClients(TgWebProxyBindManyRequest{Emails: []string{"alice", "bob"}, ProfileName: "default", Dedicated: true})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0].Email != "alice" || got[1].Email != "bob" || !got[1].Dedicated {
		t.Fatalf("BindClients = %+v, want alice and bob bound dedicated", got)
	}
	links, err := svc.ListBindings()
	if err != nil || len(links.Bindings) != 2 {
		t.Fatalf("ListBindings = %+v, %v; want 2 bindings", links, err)
	}
}

func relayProfileNamed(name string) tgwebproxy.RelayProfile {
	return tgwebproxy.RelayProfile{Name: name, Secret: bindingBaseSecret, Backend: "127.0.0.1:2398"}
}
