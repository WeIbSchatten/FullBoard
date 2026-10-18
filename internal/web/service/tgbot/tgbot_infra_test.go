package tgbot

import (
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/nicksnyder/go-i18n/v2/i18n"
	"golang.org/x/text/language"

	"github.com/WeIbSchatten/We1ssBoard/v3/internal/database/model"
	"github.com/WeIbSchatten/We1ssBoard/v3/internal/tgwebproxy"
	"github.com/WeIbSchatten/We1ssBoard/v3/internal/web/locale"
)

// englishBotLocale renders bot keys from the shipped en-US.json, so a missing
// or misspelled key shows up as the bare key in the asserted text.
func englishBotLocale(t *testing.T) {
	t.Helper()
	bundle := i18n.NewBundle(language.MustParse("en-US"))
	bundle.RegisterUnmarshalFunc("json", json.Unmarshal)
	raw, err := os.ReadFile("../../translation/en-US.json")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := bundle.ParseMessageFileBytes(raw, "en-US.json"); err != nil {
		t.Fatal(err)
	}
	orig := locale.LocalizerBot
	t.Cleanup(func() { locale.LocalizerBot = orig })
	locale.LocalizerBot = i18n.NewLocalizer(bundle, "en-US")
}

func assertContains(t *testing.T, text string, parts ...string) {
	t.Helper()
	for _, p := range parts {
		if !strings.Contains(text, p) {
			t.Fatalf("missing %q in:\n%s", p, text)
		}
	}
}

func TestNodesReportShowsEachNodeState(t *testing.T) {
	englishBotLocale(t)
	nodes := []*model.Node{
		{Name: "de-fra-1", Enable: true, Status: "online", LatencyMs: 42, CpuPct: 23.5, MemPct: 45.1, XrayVersion: "26.10.10"},
		{Name: "nl-<ams>", Enable: true, Status: "offline", LastError: "dial tcp: i/o timeout"},
		{Name: "spare", Enable: false, Status: "unknown"},
	}
	got := (&Tgbot{}).formatNodesReport(nodes)

	assertContains(t, got,
		"1/2",
		"🟢 <b>de-fra-1</b>", "42 ms", "CPU 24%", "RAM 45%", "Xray 26.10.10",
		"🔴 <b>nl-&lt;ams&gt;</b>", "dial tcp: i/o timeout",
		"⚪ <b>spare</b>",
	)
	if strings.Contains(got, "tgbot.") {
		t.Fatalf("untranslated key in:\n%s", got)
	}
}

func TestNodesReportWithoutNodes(t *testing.T) {
	englishBotLocale(t)
	got := (&Tgbot{}).formatNodesReport(nil)
	if got == "" || strings.Contains(got, "tgbot.") || strings.Contains(got, "🟢") {
		t.Fatalf("empty node list rendered as %q", got)
	}
}

func TestWebProxyReportListsBaseProfilesWithBoundClients(t *testing.T) {
	englishBotLocale(t)
	status := tgwebproxy.RelayStatus{Supported: true, BinaryInstalled: true, ConfigExists: true, Hostname: "proxy.example.com"}
	profiles := []tgwebproxy.RelayProfile{
		{Name: "default", CarrierMode: "websocket"},
		{Name: tgwebproxy.DedicatedProfileName("alice")},
		{Name: "spare"},
	}
	got := (&Tgbot{}).formatWebProxyReport(status, profiles, map[string]int{"default": 2}, "node 3: refused")

	assertContains(t, got, "proxy.example.com", "default", "websocket", "2", "spare", "https", "node 3: refused")
	if strings.Contains(got, "alice") {
		t.Fatalf("per-client managed profile listed:\n%s", got)
	}
	if strings.Contains(got, "tgbot.") {
		t.Fatalf("untranslated key in:\n%s", got)
	}
}

func TestWebProxyReportWhenRelayIsMissing(t *testing.T) {
	englishBotLocale(t)
	notInstalled := (&Tgbot{}).formatWebProxyReport(tgwebproxy.RelayStatus{Supported: true}, nil, nil, "")
	unsupported := (&Tgbot{}).formatWebProxyReport(tgwebproxy.RelayStatus{}, nil, nil, "")
	if notInstalled == unsupported || strings.Contains(notInstalled+unsupported, "tgbot.") {
		t.Fatalf("not installed = %q, unsupported = %q; want two distinct translated notes", notInstalled, unsupported)
	}
}
