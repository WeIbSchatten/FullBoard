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

// ManagedPublicDir is the panel-owned static site. Same path as stock
// tproxy-server / WEB Panel Proxy installs so the tproxy user can read it
// (paths under /var/lib/fullboard are often 0700 root and fail at runtime).
const ManagedPublicDir = "/srv/tproxy-site"

// legacyManagedPublicDir is where releases before 1.4.1 kept the managed site.
const legacyManagedPublicDir = "/var/lib/fullboard/tproxy-site"

// publicSiteDir is overridable in tests; production always uses ManagedPublicDir.
var publicSiteDir = ManagedPublicDir

var legacyPublicSiteDir = legacyManagedPublicDir

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

// DefaultPublicSiteHTML is the stock operator landing — a normal-looking app
// signup shell (same idea as WEB Panel Proxy camouflage sites).
const DefaultPublicSiteHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Anywhere app — Create account</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #14161c;
    --panel: #1a1d24;
    --field: #252830;
    --muted: #8b909a;
    --text: #f4f6fa;
    --accent: #0084ff;
    --accent-glow: rgba(0, 132, 255, 0.35);
    --line: rgba(255,255,255,0.08);
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    margin: 0;
    min-height: 100vh;
    font-family: Outfit, "Avenir Next", "Segoe UI", sans-serif;
    background: #0b0c10;
    color: var(--text);
    display: grid;
    place-items: center;
    padding: 1.25rem;
  }
  .shell {
    width: min(1100px, 100%);
    min-height: min(640px, 92vh);
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
    background: var(--panel);
    border-radius: 28px;
    overflow: hidden;
    box-shadow: 0 30px 80px rgba(0,0,0,0.45);
    position: relative;
  }
  .form-side {
    padding: clamp(1.5rem, 4vw, 2.75rem) clamp(1.4rem, 4vw, 3rem);
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 1;
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: clamp(1.5rem, 4vh, 2.75rem);
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    font-weight: 600;
    font-size: 1.05rem;
    letter-spacing: -0.01em;
    text-decoration: none;
    color: var(--text);
  }
  .brand-mark {
    width: 1.15rem; height: 1.15rem; border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 0 4px rgba(0,132,255,0.15);
  }
  .nav { display: flex; gap: 1.5rem; }
  .nav a {
    color: var(--muted); text-decoration: none; font-size: 0.95rem; font-weight: 500;
  }
  .nav a:hover { color: var(--text); }
  .eyebrow {
    margin: 0 0 0.65rem;
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 600;
  }
  h1 {
    margin: 0 0 0.55rem;
    font-size: clamp(1.85rem, 4vw, 2.55rem);
    line-height: 1.1;
    letter-spacing: -0.03em;
    font-weight: 700;
  }
  h1 .dot { color: var(--accent); }
  .member {
    margin: 0 0 1.75rem;
    color: var(--muted);
    font-size: 0.95rem;
  }
  .member a { color: var(--accent); text-decoration: none; font-weight: 600; }
  form { display: grid; gap: 1rem; max-width: 28rem; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; }
  label {
    display: grid; gap: 0.4rem;
    font-size: 0.78rem; color: var(--muted); font-weight: 500;
  }
  .field {
    display: flex; align-items: center; gap: 0.5rem;
    background: var(--field);
    border: 1px solid transparent;
    border-radius: 12px;
    padding: 0.15rem 0.85rem 0.15rem 0.95rem;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .field:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }
  .field input {
    flex: 1; min-width: 0;
    background: transparent; border: 0; outline: none;
    color: var(--text); font: inherit; font-size: 0.95rem;
    padding: 0.85rem 0;
  }
  .field svg { flex: 0 0 auto; opacity: 0.45; }
  .actions {
    display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem;
    margin-top: 0.65rem;
  }
  button {
    border: 0; cursor: pointer; font: inherit; font-weight: 600;
    border-radius: 999px; padding: 0.95rem 1rem; font-size: 0.95rem;
  }
  .btn-muted { background: #3a3f4a; color: var(--text); }
  .btn-muted:hover { background: #454b58; }
  .btn-primary {
    background: var(--accent); color: #fff;
    box-shadow: 0 10px 28px var(--accent-glow);
  }
  .btn-primary:hover { filter: brightness(1.06); }
  .art {
    position: relative;
    background:
      linear-gradient(105deg, rgba(20,22,28,0.92) 0%, rgba(20,22,28,0.35) 28%, rgba(20,22,28,0.15) 45%, transparent 60%),
      linear-gradient(180deg, rgba(10,12,18,0.15), rgba(10,12,18,0.55)),
      radial-gradient(120% 80% at 70% 20%, #4a5568 0%, transparent 55%),
      linear-gradient(180deg, #2c3340 0%, #1a1f28 40%, #0f1218 100%);
    overflow: hidden;
  }
  .art::before {
    content: "";
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 80% 45% at 60% 35%, rgba(180,190,210,0.35), transparent 60%),
      radial-gradient(ellipse 70% 50% at 75% 70%, rgba(40,50,65,0.9), transparent 55%);
    opacity: 0.9;
  }
  .mountains {
    position: absolute; inset: auto 0 0 0; height: 72%;
    background:
      linear-gradient(165deg, transparent 35%, #1b222d 36%, #12171f 70%),
      linear-gradient(195deg, transparent 30%, #252d3a 31%, #151a22 75%),
      linear-gradient(180deg, transparent 20%, #0e1218 100%);
    clip-path: polygon(0 55%, 18% 38%, 34% 48%, 52% 28%, 68% 42%, 82% 30%, 100% 40%, 100% 100%, 0 100%);
    opacity: 0.95;
  }
  .trees {
    position: absolute; inset: auto 0 0 0; height: 38%;
    background-image: repeating-linear-gradient(90deg,
      transparent 0 14px,
      rgba(8,10,14,0.55) 14px 18px,
      transparent 18px 34px);
    mask-image: linear-gradient(180deg, transparent, #000 35%);
    opacity: 0.7;
  }
  .wave {
    position: absolute; left: -1px; top: 8%; bottom: 8%; width: 2px;
    border-left: 2px dashed rgba(255,255,255,0.18);
    transform: translateX(-50%);
    z-index: 2;
  }
  .mono {
    position: absolute; right: 1.5rem; bottom: 1.35rem;
    width: 2.4rem; height: 2.4rem; opacity: 0.9;
  }
  @media (max-width: 860px) {
    .shell { grid-template-columns: 1fr; min-height: auto; }
    .art { min-height: 220px; order: -1; }
    .wave { display: none; }
    .row, .actions { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
  <div class="shell">
    <section class="form-side">
      <div class="top">
        <a class="brand" href="#"><span class="brand-mark" aria-hidden="true"></span>Anywhere app.</a>
        <nav class="nav" aria-label="Primary">
          <a href="#home">Home</a>
          <a href="#join">Join</a>
        </nav>
      </div>
      <p class="eyebrow">Start for free</p>
      <h1>Create new account<span class="dot">.</span></h1>
      <p class="member">Already A Member? <a href="#login">Log In</a></p>
      <form action="#" method="post" novalidate>
        <div class="row">
          <label>First name
            <span class="field">
              <input name="first" autocomplete="given-name" value="Michal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.5"/><path d="M5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5"/></svg>
            </span>
          </label>
          <label>Last name
            <span class="field">
              <input name="last" autocomplete="family-name" value="Masiak">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.5"/><path d="M5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5"/></svg>
            </span>
          </label>
        </div>
        <label>Email
          <span class="field">
            <input type="email" name="email" autocomplete="email" value="michal.masiak@anywhere.co">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>
          </span>
        </label>
        <label>Password
          <span class="field">
            <input type="password" name="password" autocomplete="new-password" value="password123" id="pw">
            <button type="button" id="toggle-pw" aria-label="Show password" style="background:none;border:0;padding:0;display:grid;place-items:center;color:inherit;cursor:pointer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>
            </button>
          </span>
        </label>
        <div class="actions">
          <button type="button" class="btn-muted">Change method</button>
          <button type="submit" class="btn-primary">Create account</button>
        </div>
      </form>
    </section>
    <aside class="art" aria-hidden="true">
      <div class="wave"></div>
      <div class="mountains"></div>
      <div class="trees"></div>
      <svg class="mono" viewBox="0 0 48 48" fill="none">
        <path d="M8 36 20 8h6l8 18 8-18h6L34 36h-6l-8-18-8 18H8Z" fill="#f4f6fa"/>
      </svg>
    </aside>
  </div>
  <script>
    document.querySelector("form").addEventListener("submit", function (e) { e.preventDefault(); });
    document.getElementById("toggle-pw").addEventListener("click", function () {
      var input = document.getElementById("pw");
      input.type = input.type === "password" ? "text" : "password";
    });
  </script>
</body>
</html>
`

// PublicSiteFile is one entry under the managed public directory.
type PublicSiteFile struct {
	Name string `json:"name" example:"index.html"`
	Size int64  `json:"size" example:"2048"`
}

// PublicSitePreset is a built-in landing page the editor can load and save.
type PublicSitePreset struct {
	ID   string `json:"id" example:"signup"`
	HTML string `json:"html"`
}

// PublicSitePresets lists the built-in landings; the first is the reset default.
func PublicSitePresets() []PublicSitePreset {
	return []PublicSitePreset{
		{ID: "signup", HTML: DefaultPublicSiteHTML},
		{ID: "cats", HTML: CatsPublicSiteHTML},
	}
}

// PublicSiteSnapshot is the panel-managed static site state.
type PublicSiteSnapshot struct {
	Dir             string             `json:"dir" example:"/srv/tproxy-site"`
	Active          bool               `json:"active" example:"true"`
	IndexHTML       string             `json:"indexHtml"`
	Files           []PublicSiteFile   `json:"files"`
	DefaultHTML     string             `json:"defaultHtml"`
	ConfigPublicDir string             `json:"configPublicDir" example:"/srv/tproxy-site"`
	Presets         []PublicSitePreset `json:"presets"`
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
	switch _, err := os.Stat(index); {
	case err == nil:
	case !errors.Is(err, fs.ErrNotExist):
		return err
	default:
		copied, err := copyLegacyPublicSite(dir)
		if err != nil {
			return err
		}
		if !copied {
			if err := os.WriteFile(index, []byte(DefaultPublicSiteHTML), 0o644); err != nil {
				return err
			}
		}
	}
	return makePublicSiteReadable(dir)
}

// makePublicSiteReadable undoes the panel's UMask=0077: the relay runs as the
// unprivileged tproxy user and exits at start-up if it cannot read a file.
func makePublicSiteReadable(dir string) error {
	if err := os.Chmod(dir, 0o755); err != nil {
		return fmt.Errorf("chmod public site dir: %w", err)
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}
	for _, e := range entries {
		if !e.Type().IsRegular() {
			continue
		}
		if err := os.Chmod(filepath.Join(dir, e.Name()), 0o644); err != nil {
			return fmt.Errorf("chmod public site %s: %w", e.Name(), err)
		}
	}
	return nil
}

// copyLegacyPublicSite seeds a fresh managed dir from the pre-1.4.1 location so
// an operator's edited landing page survives the move to /srv/tproxy-site.
func copyLegacyPublicSite(dir string) (bool, error) {
	if legacyPublicSiteDir == dir {
		return false, nil
	}
	if _, err := os.Stat(filepath.Join(legacyPublicSiteDir, "index.html")); err != nil {
		return false, nil
	}
	entries, err := os.ReadDir(legacyPublicSiteDir)
	if err != nil {
		return false, nil
	}
	for _, e := range entries {
		if !e.Type().IsRegular() {
			continue
		}
		name, err := sanitizePublicSiteName(e.Name())
		if err != nil {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(legacyPublicSiteDir, name))
		if err != nil {
			return false, fmt.Errorf("read legacy public site %s: %w", name, err)
		}
		if err := os.WriteFile(filepath.Join(dir, name), raw, 0o644); err != nil {
			return false, fmt.Errorf("copy legacy public site %s: %w", name, err)
		}
	}
	return true, nil
}

func (m *Manager) GetPublicSite() (PublicSiteSnapshot, error) {
	dir := publicSiteDir
	snap := PublicSiteSnapshot{
		Dir:         dir,
		DefaultHTML: DefaultPublicSiteHTML,
		Files:       []PublicSiteFile{},
		Presets:     PublicSitePresets(),
	}
	if cfgSnap, err := m.store.Load(); err == nil {
		snap.ConfigPublicDir = cfgSnap.Config.PublicDir
		snap.Active = cfgSnap.Config.PublicDir == dir
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
	index := filepath.Join(dir, "index.html")
	if err := os.WriteFile(index, []byte(html), 0o644); err != nil {
		return err
	}
	return os.Chmod(index, 0o644)
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
	if err := os.Chmod(tmpName, 0o644); err != nil {
		return err
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
	if err := EnsurePublicSiteDir(cfg.PublicDir); err != nil {
		return RelayApplyResult{}, err
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
