package tgwebproxy

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func withTempPublicSite(t *testing.T) string {
	t.Helper()
	dir := filepath.Join(t.TempDir(), "tproxy-site")
	prev, prevLegacy := publicSiteDir, legacyPublicSiteDir
	publicSiteDir = dir
	legacyPublicSiteDir = filepath.Join(t.TempDir(), "no-legacy-site")
	t.Cleanup(func() { publicSiteDir, legacyPublicSiteDir = prev, prevLegacy })
	return dir
}

func TestEnsurePublicSiteDirWritesDefaultOnce(t *testing.T) {
	dir := withTempPublicSite(t)
	if err := EnsurePublicSiteDir(dir); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(filepath.Join(dir, "index.html"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), "Anywhere app") || !strings.Contains(string(raw), "Create new account") {
		t.Fatalf("expected default landing page, got %q", string(raw)[:min(80, len(raw))])
	}
	custom := "<html><body>custom</body></html>"
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte(custom), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := EnsurePublicSiteDir(dir); err != nil {
		t.Fatal(err)
	}
	raw, err = os.ReadFile(filepath.Join(dir, "index.html"))
	if err != nil {
		t.Fatal(err)
	}
	if string(raw) != custom {
		t.Fatalf("EnsurePublicSiteDir overwrote existing index.html")
	}
}

func TestWritePublicSiteIndexRejectsNULAndEmpty(t *testing.T) {
	_ = withTempPublicSite(t)
	if err := WritePublicSiteIndex(""); err == nil {
		t.Fatal("expected empty rejection")
	}
	if err := WritePublicSiteIndex("ok\x00bad"); err == nil {
		t.Fatal("expected NUL rejection")
	}
	if err := WritePublicSiteIndex("<html>ok</html>"); err != nil {
		t.Fatal(err)
	}
}

func TestSanitizePublicSiteName(t *testing.T) {
	cases := []struct {
		in   string
		want string
		ok   bool
	}{
		{"style.css", "style.css", true},
		{"../etc/passwd", "", false},
		{"foo/bar.png", "", false},
		{"evil.exe", "", false},
		{"logo.PNG", "logo.PNG", true},
	}
	for _, tc := range cases {
		got, err := sanitizePublicSiteName(tc.in)
		if tc.ok {
			if err != nil || got != tc.want {
				t.Fatalf("%q: got %q err %v", tc.in, got, err)
			}
			continue
		}
		if err == nil {
			t.Fatalf("%q: expected error", tc.in)
		}
	}
}

func TestUploadAndDeletePublicSiteAsset(t *testing.T) {
	dir := withTempPublicSite(t)
	m := NewManager(DefaultPaths(t.TempDir()), nil)
	if err := m.UploadPublicSiteAsset("style.css", bytes.NewReader([]byte("body{}")), 6); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dir, "style.css")); err != nil {
		t.Fatal(err)
	}
	if err := m.DeletePublicSiteAsset("index.html"); err == nil {
		t.Fatal("expected index delete rejection")
	}
	if err := m.DeletePublicSiteAsset("style.css"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dir, "style.css")); !os.IsNotExist(err) {
		t.Fatalf("expected deleted file, err=%v", err)
	}
}

func withTempLegacyPublicSite(t *testing.T) string {
	t.Helper()
	dir := filepath.Join(t.TempDir(), "legacy-site")
	prev := legacyPublicSiteDir
	legacyPublicSiteDir = dir
	t.Cleanup(func() { legacyPublicSiteDir = prev })
	return dir
}

func TestEnsurePublicSiteDirCarriesOverLegacySite(t *testing.T) {
	dir := withTempPublicSite(t)
	legacy := withTempLegacyPublicSite(t)
	if err := os.MkdirAll(legacy, 0o755); err != nil {
		t.Fatal(err)
	}
	custom := "<html><body>operator page</body></html>"
	files := map[string]string{"index.html": custom, "style.css": "body{}", "notes.exe": "x"}
	for name, body := range files {
		if err := os.WriteFile(filepath.Join(legacy, name), []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	if err := EnsurePublicSiteDir(dir); err != nil {
		t.Fatal(err)
	}

	for name, want := range map[string]string{"index.html": custom, "style.css": "body{}"} {
		got, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil || string(got) != want {
			t.Fatalf("%s = %q, %v; want the legacy file carried over", name, got, err)
		}
	}
	if _, err := os.Stat(filepath.Join(dir, "notes.exe")); !os.IsNotExist(err) {
		t.Fatalf("non-allowlisted legacy file was copied (err=%v)", err)
	}
}

func TestGetPublicSiteReportsLegacyPublicDirAsInactive(t *testing.T) {
	_ = withTempPublicSite(t)
	legacy := withTempLegacyPublicSite(t)
	m, paths := newTestManager(t, &fakeRunner{})
	cfg := testConfig()
	cfg.PublicUpstream = ""
	cfg.PublicDir = legacy
	raw, err := json.Marshal(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Dir(paths.ConfigFile), 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(paths.ConfigFile, raw, 0o640); err != nil {
		t.Fatal(err)
	}

	snap, err := m.GetPublicSite()
	if err != nil {
		t.Fatal(err)
	}
	if snap.Active {
		t.Fatalf("Active = true while the relay still serves %s, which the panel no longer edits", legacy)
	}
	if snap.ConfigPublicDir != legacy {
		t.Fatalf("ConfigPublicDir = %q, want %q", snap.ConfigPublicDir, legacy)
	}
}

func TestPublicSitePresetsKeepResetDefaultFirstAndShipSelfContainedCats(t *testing.T) {
	presets := PublicSitePresets()
	if len(presets) < 2 || presets[0].HTML != DefaultPublicSiteHTML {
		t.Fatalf("first preset must be the reset default, got %d presets", len(presets))
	}
	var cats string
	for _, p := range presets {
		if p.ID == "cats" {
			cats = p.HTML
		}
	}
	if cats == "" {
		t.Fatal("cats preset missing")
	}
	// The relay serves the site from memory; an external asset would leak the
	// visitor to a third party and break offline hosts.
	for _, ref := range []string{"http://", "https://", "//fonts."} {
		if strings.Contains(cats, ref) {
			t.Fatalf("cats preset references an external resource (%q)", ref)
		}
	}
}
