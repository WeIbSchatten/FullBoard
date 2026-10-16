//go:build unix

package tgwebproxy

import (
	"bytes"
	"os"
	"path/filepath"
	"syscall"
	"testing"
)

// fullboard.service runs with UMask=0077; the relay reads the site as the
// unprivileged tproxy user, so every published path must stay world-readable.
func withPanelUmask(t *testing.T) {
	t.Helper()
	prev := syscall.Umask(0o077)
	t.Cleanup(func() { syscall.Umask(prev) })
}

func assertMode(t *testing.T, path string, want os.FileMode) {
	t.Helper()
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if got := info.Mode().Perm(); got != want {
		t.Fatalf("%s mode = %o, want %o (tproxy cannot read it)", filepath.Base(path), got, want)
	}
}

func TestPublicSiteStaysReadableUnderPanelUmask(t *testing.T) {
	withPanelUmask(t)
	dir := withTempPublicSite(t)

	if err := WritePublicSiteIndex("<html>ok</html>"); err != nil {
		t.Fatal(err)
	}
	m := NewManager(DefaultPaths(t.TempDir()), nil)
	if err := m.UploadPublicSiteAsset("style.css", bytes.NewReader([]byte("body{}")), 6); err != nil {
		t.Fatal(err)
	}

	assertMode(t, dir, 0o755)
	assertMode(t, filepath.Join(dir, "index.html"), 0o644)
	assertMode(t, filepath.Join(dir, "style.css"), 0o644)
}

func TestEnsurePublicSiteDirRepairsUnreadableFiles(t *testing.T) {
	dir := withTempPublicSite(t)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html>old</html>"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(dir, 0o700); err != nil {
		t.Fatal(err)
	}

	if err := EnsurePublicSiteDir(dir); err != nil {
		t.Fatal(err)
	}

	assertMode(t, dir, 0o755)
	assertMode(t, filepath.Join(dir, "index.html"), 0o644)
}
