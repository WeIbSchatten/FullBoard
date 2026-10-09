// Package relaytest builds a tgwebproxy.Manager over a throwaway directory so
// other packages' tests can exercise real config.json/profiles.json files.
package relaytest

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/WeIbSchatten/FullBoard/v3/internal/tgwebproxy"
)

// New seeds a relay with hostname and the given profiles (at least one). The
// `tproxy-server -check` binary and systemd are stubbed out.
func New(t testing.TB, hostname string, profiles ...tgwebproxy.RelayProfile) *tgwebproxy.Manager {
	t.Helper()
	dir := t.TempDir()
	paths := tgwebproxy.Paths{
		ConfigFile:   filepath.Join(dir, "etc", "config.json"),
		ProfilesFile: filepath.Join(dir, "etc", "profiles.json"),
		Binary:       filepath.Join(dir, "tproxy-server"),
		SourceDir:    filepath.Join(dir, "src"),
		JobDir:       filepath.Join(dir, "jobs"),
	}
	if err := os.WriteFile(paths.Binary, []byte("#!/bin/true\n"), 0o755); err != nil {
		t.Fatalf("relaytest: stub binary: %v", err)
	}
	m := tgwebproxy.NewManager(paths, func(context.Context, string, ...string) ([]byte, error) { return nil, nil })
	cfg := tgwebproxy.NewRelayConfig()
	cfg.PublicHostname = hostname
	if _, err := m.SaveConfig(context.Background(), cfg, &profiles[0]); err != nil {
		t.Fatalf("relaytest: seed config: %v", err)
	}
	for _, p := range profiles[1:] {
		if _, err := m.AddProfile(context.Background(), p); err != nil {
			t.Fatalf("relaytest: seed profile %q: %v", p.Name, err)
		}
	}
	return m
}
