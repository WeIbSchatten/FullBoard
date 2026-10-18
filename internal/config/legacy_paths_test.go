package config

import (
	"os"
	"path/filepath"
	"testing"
)

func touch(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
}

// A pre-1.7.0 install (Docker volume, hand-made layout) still holds fullboard.db;
// pointing it at an empty we1ssboard.db would boot a blank panel.
func TestDBPathInPrefersExistingLegacyFile(t *testing.T) {
	cases := []struct {
		name  string
		files []string
		want  string
	}{
		{"fresh folder", nil, "we1ssboard.db"},
		{"only legacy db", []string{"fullboard.db"}, "fullboard.db"},
		{"both present", []string{"fullboard.db", "we1ssboard.db"}, "we1ssboard.db"},
		{"only new db", []string{"we1ssboard.db"}, "we1ssboard.db"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			for _, f := range tc.files {
				touch(t, filepath.Join(dir, f))
			}
			got := dbPathIn(dir)
			if want := dir + "/" + tc.want; got != want {
				t.Fatalf("dbPathIn = %q, want %q", got, want)
			}
		})
	}
}

func TestResolveDBFolderFallsBackToLegacyFolder(t *testing.T) {
	cases := []struct {
		name  string
		files []string
		want  string
	}{
		{"fresh install", nil, "new"},
		{"legacy folder holds the db", []string{"old/fullboard.db"}, "old"},
		{"migrated install", []string{"old/fullboard.db", "new/we1ssboard.db"}, "new"},
		{"legacy folder without db", []string{"old/node_token_key.json"}, "new"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			root := t.TempDir()
			for _, f := range tc.files {
				touch(t, filepath.Join(root, f))
			}
			got := resolveDBFolder(filepath.Join(root, "new"), filepath.Join(root, "old"))
			if want := filepath.Join(root, tc.want); got != want {
				t.Fatalf("resolveDBFolder = %q, want %q", got, want)
			}
		})
	}
}

// Node tokens are encrypted with this key; losing it on a legacy volume makes
// every stored node token undecryptable.
func TestLegacyFallbackForNodeTokenKey(t *testing.T) {
	root := t.TempDir()
	cur := filepath.Join(root, "new", "node_token_key.json")
	old := filepath.Join(root, "old", "node_token_key.json")

	if got := legacyFallback(cur, old); got != cur {
		t.Fatalf("no key anywhere: got %q, want %q", got, cur)
	}
	touch(t, old)
	if got := legacyFallback(cur, old); got != old {
		t.Fatalf("only legacy key: got %q, want %q", got, old)
	}
	touch(t, cur)
	if got := legacyFallback(cur, old); got != cur {
		t.Fatalf("both keys: got %q, want %q", got, cur)
	}
}
