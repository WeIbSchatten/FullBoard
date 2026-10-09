package tgwebproxy

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func withTempPublicSite(t *testing.T) string {
	t.Helper()
	dir := filepath.Join(t.TempDir(), "tproxy-site")
	prev := publicSiteDir
	publicSiteDir = dir
	t.Cleanup(func() { publicSiteDir = prev })
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
	if !strings.Contains(string(raw), "Welcome") {
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
