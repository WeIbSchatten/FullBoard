package service

import (
	"errors"
	"slices"
	"testing"

	"github.com/WeIbSchatten/FullBoard/v3/internal/database"
	"github.com/WeIbSchatten/FullBoard/v3/internal/database/model"
	"github.com/WeIbSchatten/FullBoard/v3/internal/web/runtime"
)

func TestRemoteLogsRequestAllowlist(t *testing.T) {
	cases := []struct {
		name      string
		req       RemoteLogsRequest
		wantErr   bool
		wantCount int
		wantLevel string
	}{
		{"panel defaults", RemoteLogsRequest{Source: "panel"}, false, 100, "info"},
		{"panel explicit level", RemoteLogsRequest{Source: "panel", Count: 500, Level: "err"}, false, 500, "err"},
		{"xray with filter", RemoteLogsRequest{Source: "xray", Count: 20, Filter: "user@example.com"}, false, 20, ""},
		{"unknown source is not proxied", RemoteLogsRequest{Source: "shell"}, true, 0, ""},
		{"journalctl level injection", RemoteLogsRequest{Source: "panel", Level: "err --since=1"}, true, 0, ""},
		{"count above node cap", RemoteLogsRequest{Source: "panel", Count: 10001}, true, 0, ""},
		{"negative count", RemoteLogsRequest{Source: "xray", Count: -1}, true, 0, ""},
		{"filter with control byte", RemoteLogsRequest{Source: "xray", Filter: "a\x00b"}, true, 0, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			req := c.req
			err := req.normalize()
			if c.wantErr {
				if !errors.Is(err, ErrRemoteInvalidRequest) {
					t.Fatalf("normalize() = %v, want ErrRemoteInvalidRequest", err)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if req.Count != c.wantCount || req.Level != c.wantLevel {
				t.Fatalf("normalized to count=%d level=%q, want %d %q", req.Count, req.Level, c.wantCount, c.wantLevel)
			}
		})
	}
}

// Rejected before any node lookup, so a bad value never reaches a remote panel.
func TestRemoteAdminProxyRejectsMalformedInputBeforeContactingNode(t *testing.T) {
	s := &NodeService{}
	cases := []struct {
		name string
		call func() error
	}{
		{"xray version with path traversal", func() error { return s.InstallRemoteXray(1, "../../etc/passwd") }},
		{"empty xray version", func() error { return s.InstallRemoteXray(1, "") }},
		{"geofile with separator", func() error { return s.UpdateRemoteGeofile(1, "../geoip.dat") }},
		{"geofile that is not .dat", func() error { return s.UpdateRemoteGeofile(1, "config.json") }},
		{"xray template that is not an object", func() error { return s.UpdateRemoteXraySetting(1, `[1]`, "") }},
		{"empty backup", func() error { return s.ImportRemoteBackup(1, nil, true) }},
		{"adopt without tag", func() error { return s.AdoptRemoteInbound(1, "  ") }},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if err := c.call(); !errors.Is(err, ErrRemoteInvalidRequest) {
				t.Fatalf("err = %v, want ErrRemoteInvalidRequest", err)
			}
		})
	}
}

func TestMarkLiveInboundsRecognisesPrefixedAndBareCentralTags(t *testing.T) {
	options := []runtime.RemoteInboundOption{
		{Id: 1, Tag: "in-443-tcp", Port: 443, Protocol: model.VLESS},
		{Id: 2, Tag: "in-8443-tcp", Port: 8443, Protocol: model.Trojan},
		{Id: 3, Tag: "in-9000-tcp", Port: 9000, Protocol: model.VMESS},
	}
	got := markLiveInbounds(7, options, []string{"n7-in-443-tcp", "in-8443-tcp", "n9-in-9000-tcp"})
	want := map[string]bool{"in-443-tcp": true, "in-8443-tcp": true, "in-9000-tcp": false}
	for _, ib := range got {
		if ib.Adopted != want[ib.Tag] {
			t.Errorf("%s adopted = %v, want %v (another node's prefix must not count)", ib.Tag, ib.Adopted, want[ib.Tag])
		}
	}
	if got[1].Protocol != "trojan" || got[1].Port != 8443 {
		t.Fatalf("fields not carried over: %+v", got[1])
	}
}

func TestSelectNodeInboundAddsTagAndResetsAdoptionMarker(t *testing.T) {
	setupConflictDB(t)
	db := database.GetDB()
	node := &model.Node{
		Name: "n", Address: "node.example.com", Port: 2053, Scheme: "https", Enable: true,
		InboundSyncMode: "selected", InboundTags: []string{"in-443-tcp"}, InboundsAdoptedAt: 123,
	}
	if err := db.Create(node).Error; err != nil {
		t.Fatal(err)
	}

	if err := (&NodeService{}).selectNodeInboundTx(db, node.Id, "in-8443-tcp"); err != nil {
		t.Fatal(err)
	}

	var got model.Node
	if err := db.First(&got, node.Id).Error; err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(got.InboundTags, []string{"in-443-tcp", "in-8443-tcp"}) {
		t.Fatalf("inbound tags = %v", got.InboundTags)
	}
	if got.InboundsAdoptedAt != 0 {
		t.Fatalf("InboundsAdoptedAt = %d, want 0 so the sweep waits for the clean sync", got.InboundsAdoptedAt)
	}
	if !got.ConfigDirty {
		t.Fatal("node not marked dirty, so the adoption would wait for an unrelated change")
	}
}

func TestSelectNodeInboundLeavesAllModeSelectionAlone(t *testing.T) {
	setupConflictDB(t)
	db := database.GetDB()
	node := &model.Node{
		Name: "n", Address: "node.example.com", Port: 2053, Scheme: "https", Enable: true,
		InboundSyncMode: "all", InboundsAdoptedAt: 123,
	}
	if err := db.Create(node).Error; err != nil {
		t.Fatal(err)
	}

	if err := (&NodeService{}).selectNodeInboundTx(db, node.Id, "in-443-tcp"); err != nil {
		t.Fatal(err)
	}

	var got model.Node
	if err := db.First(&got, node.Id).Error; err != nil {
		t.Fatal(err)
	}
	if len(got.InboundTags) != 0 || got.InboundsAdoptedAt != 123 {
		t.Fatalf("all-mode node was rewritten: tags=%v adoptedAt=%d", got.InboundTags, got.InboundsAdoptedAt)
	}
}
