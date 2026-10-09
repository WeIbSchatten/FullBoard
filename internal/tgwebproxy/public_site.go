package tgwebproxy

import (
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// ManagedPublicDir is the panel-owned static site served when public_dir is
// pointed at FullBoard's managed tproxy landing page.
const ManagedPublicDir = "/var/lib/fullboard/tproxy-site"

// publicSiteDir is overridable in tests; production always uses ManagedPublicDir.
var publicSiteDir = ManagedPublicDir

const (
	maxPublicSiteHTMLBytes  = 512 << 10 // 512 KiB
	maxPublicSiteAssetBytes = 2 << 20   // 2 MiB
)

var allowedPublicSiteExt = map[string]bool{
	".html":  true,
	".htm":   true,
	".css":   true,
	".js":    true,
	".svg":   true,
	".png":   true,
	".jpg":   true,
	".jpeg":  true,
	".gif":   true,
	".webp":  true,
	".ico":   true,
	".woff":  true,
	".woff2": true,
	".txt":   true,
}

// DefaultPublicSiteHTML is a minimal landing page — not a fingerprint starter.
const DefaultPublicSiteHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Welcome</title>
<style>
  :root { color-scheme: light dark; --fg: #1a1a1a; --muted: #5c5c5c; --bg: #f7f5f0; --accent: #0b6e4f; }
  @media (prefers-color-scheme: dark) {
    :root { --fg: #f0ece4; --muted: #a39e94; --bg: #121410; --accent: #3dba8c; }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; font-family: "Segoe UI", system-ui, sans-serif;
    background: radial-gradient(1200px 600px at 10% -10%, #d9efe6 0%, transparent 55%),
                radial-gradient(900px 500px at 100% 0%, #e8e0d0 0%, transparent 50%),
                var(--bg);
    color: var(--fg); display: grid; place-items: center; padding: 2rem;
  }
  main { max-width: 36rem; }
  h1 { font-size: clamp(2rem, 5vw, 2.75rem); font-weight: 650; letter-spacing: -0.02em; margin: 0 0 0.75rem; }
  p { margin: 0; line-height: 1.55; color: var(--muted); font-size: 1.05rem; }
  a { color: var(--accent); }
</style>
</head>
<body>
<main>
  <h1>Welcome</h1>
  <p>This host is online. Edit this page from the FullBoard panel under Telegram WEB Proxy → Public site.</p>
</main>
</body>
</html>
`

// PublicSiteFile is one entry under the managed public directory.
type PublicSiteFile struct {
	Name string `json:"name" example:"index.html"`
	Size int64  `json:"size" example:"2048"`
}

// PublicSiteSnapshot is the panel-managed static site state.
type PublicSiteSnapshot struct {
	Dir             string           `json:"dir" example:"/var/lib/fullboard/tproxy-site"`
	Active          bool             `json:"active" example:"true"`
	IndexHTML       string           `json:"indexHtml"`
	Files           []PublicSiteFile `json:"files"`
	DefaultHTML     string           `json:"defaultHtml"`
	ConfigPublicDir string           `json:"configPublicDir" example:"/var/lib/fullboard/tproxy-site"`
}

func (m *Manager) PublicSiteDir() string {
	return publicSiteDir
}

// EnsurePublicSiteDir creates the managed directory with a default index.html
// when missing. Safe to call repeatedly.
func EnsurePublicSiteDir(dir string) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create public site dir: %w", err)
	}
	index := filepath.Join(dir, "index.html")
	if _, err := os.Stat(index); err == nil {
		return nil
	} else if !errors.Is(err, fs.ErrNotExist) {
		return err
	}
	return os.WriteFile(index, []byte(DefaultPublicSiteHTML), 0o644)
}

func (m *Manager) GetPublicSite() (PublicSiteSnapshot, error) {
	dir := publicSiteDir
	snap := PublicSiteSnapshot{
		Dir:         dir,
		DefaultHTML: DefaultPublicSiteHTML,
		Files:       []PublicSiteFile{},
	}
	if cfgSnap, err := m.store.Load(); err == nil {
		snap.ConfigPublicDir = cfgSnap.Config.PublicDir
		snap.Active = cfgSnap.Config.PublicDir == dir || cfgSnap.Config.PublicDir == ManagedPublicDir
	}
	if err := EnsurePublicSiteDir(dir); err != nil {
		return snap, err
	}
	raw, err := os.ReadFile(filepath.Join(dir, "index.html"))
	if err != nil {
		return snap, err
	}
	snap.IndexHTML = string(raw)
	entries, err := os.ReadDir(dir)
	if err != nil {
		return snap, err
	}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		snap.Files = append(snap.Files, PublicSiteFile{Name: e.Name(), Size: info.Size()})
	}
	return snap, nil
}

// WritePublicSiteIndex writes index.html without touching relay config.
func WritePublicSiteIndex(html string) error {
	if len(html) == 0 {
		return errors.New("index.html must not be empty")
	}
	if len(html) > maxPublicSiteHTMLBytes {
		return fmt.Errorf("index.html exceeds %d bytes", maxPublicSiteHTMLBytes)
	}
	if strings.ContainsRune(html, 0) {
		return errors.New("index.html must not contain NUL bytes")
	}
	dir := publicSiteDir
	if err := EnsurePublicSiteDir(dir); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, "index.html"), []byte(html), 0o644)
}

// PutPublicSiteIndex writes index.html and points config public_dir at the
// managed directory (clearing public_upstream).
func (m *Manager) PutPublicSiteIndex(ctx context.Context, html string) (RelayApplyResult, error) {
	if err := WritePublicSiteIndex(html); err != nil {
		return RelayApplyResult{}, err
	}
	return m.applyManagedPublicDir(ctx)
}

// ResetPublicSite restores the built-in template and activates managed public_dir.
func (m *Manager) ResetPublicSite(ctx context.Context) (RelayApplyResult, error) {
	return m.PutPublicSiteIndex(ctx, DefaultPublicSiteHTML)
}

// UploadPublicSiteAsset writes an allowlisted file under the managed directory.
func (m *Manager) UploadPublicSiteAsset(name string, r io.Reader, size int64) error {
	clean, err := sanitizePublicSiteName(name)
	if err != nil {
		return err
	}
	if size < 0 || size > maxPublicSiteAssetBytes {
		return fmt.Errorf("asset exceeds %d bytes", maxPublicSiteAssetBytes)
	}
	dir := publicSiteDir
	if err := EnsurePublicSiteDir(dir); err != nil {
		return err
	}
	dst := filepath.Join(dir, clean)
	tmp, err := os.CreateTemp(dir, ".upload-*")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer func() { _ = os.Remove(tmpName) }()
	limited := io.LimitReader(r, maxPublicSiteAssetBytes+1)
	n, err := io.Copy(tmp, limited)
	if cerr := tmp.Close(); cerr != nil && err == nil {
		err = cerr
	}
	if err != nil {
		return err
	}
	if n > maxPublicSiteAssetBytes {
		return fmt.Errorf("asset exceeds %d bytes", maxPublicSiteAssetBytes)
	}
	return os.Rename(tmpName, dst)
}

// DeletePublicSiteAsset removes a non-index asset from the managed directory.
func (m *Manager) DeletePublicSiteAsset(name string) error {
	clean, err := sanitizePublicSiteName(name)
	if err != nil {
		return err
	}
	if clean == "index.html" {
		return errors.New("cannot delete index.html; reset or overwrite it instead")
	}
	path := filepath.Join(publicSiteDir, clean)
	if err := os.Remove(path); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return err
	}
	return nil
}

func (m *Manager) applyManagedPublicDir(ctx context.Context) (RelayApplyResult, error) {
	snap, err := m.store.Load()
	if err != nil {
		return RelayApplyResult{}, err
	}
	cfg := snap.Config
	cfg.PublicDir = ManagedPublicDir
	if publicSiteDir != ManagedPublicDir {
		cfg.PublicDir = publicSiteDir
	}
	cfg.PublicUpstream = ""
	var initial *RelayProfile
	if len(snap.Profiles) == 0 {
		return RelayApplyResult{}, errors.New("save a relay config with an initial profile before activating the public site")
	}
	return m.SaveConfig(ctx, cfg, initial)
}

func sanitizePublicSiteName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", errors.New("file name is required")
	}
	base := filepath.Base(name)
	if base != name || strings.Contains(name, "..") || strings.ContainsAny(name, `/\`) {
		return "", errors.New("file name must be a single path segment")
	}
	ext := strings.ToLower(filepath.Ext(base))
	if !allowedPublicSiteExt[ext] {
		return "", fmt.Errorf("extension %q is not allowed", ext)
	}
	return base, nil
}
