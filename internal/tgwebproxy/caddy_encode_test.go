package tgwebproxy

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPatchCaddyEncodeForH2WS(t *testing.T) {
	in := `example.com {
	encode zstd gzip
	reverse_proxy 127.0.0.1:8080
}
`
	out, changed := PatchCaddyEncodeForH2WS(in)
	if !changed {
		t.Fatal("expected patch to change a bare encode line")
	}
	if !strings.Contains(out, "@not_h2_ws not {") {
		t.Fatalf("missing matcher:\n%s", out)
	}
	if !strings.Contains(out, "encode @not_h2_ws zstd gzip") {
		t.Fatalf("encode not gated:\n%s", out)
	}
	if CaddyEncodeNeedsH2WSPatch(out) {
		t.Fatal("patched file still reported as needing a fix")
	}
	again, changed := PatchCaddyEncodeForH2WS(out)
	if changed || again != out {
		t.Fatal("second patch must be a no-op")
	}
}

func TestPatchCaddyEncodeSkipsAlreadyGated(t *testing.T) {
	in := `example.com {
	@not_h2_ws not {
		header :protocol *
		method CONNECT
		protocol http/2
	}
	encode @not_h2_ws zstd gzip
}
`
	_, changed := PatchCaddyEncodeForH2WS(in)
	if changed {
		t.Fatal("already-gated encode must not be rewritten")
	}
}

func TestApplyCaddyEncodeH2WSPatchRoundTrip(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "Caddyfile")
	if err := os.WriteFile(path, []byte("host {\n\tencode gzip\n}\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	changed, err := ApplyCaddyEncodeH2WSPatch(path)
	if err != nil || !changed {
		t.Fatalf("apply: changed=%v err=%v", changed, err)
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), "encode @not_h2_ws gzip") {
		t.Fatalf("file not patched: %s", raw)
	}
	changed, err = ApplyCaddyEncodeH2WSPatch(path)
	if err != nil || changed {
		t.Fatalf("second apply: changed=%v err=%v", changed, err)
	}
}
