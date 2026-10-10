package tgwebproxy

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
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
	if strings.Contains(out, "\n\tencode ") || strings.Contains(out, "\nencode ") {
		t.Fatalf("active encode must be removed:\n%s", out)
	}
	if !strings.Contains(out, "fullboard-h2-ws-begin") || !strings.Contains(out, "encode disabled") {
		t.Fatalf("missing disabled marker block:\n%s", out)
	}
	if CaddyEncodeNeedsH2WSPatch(out) {
		t.Fatal("patched file still reported as needing a fix")
	}
	again, changed := PatchCaddyEncodeForH2WS(out)
	if changed || again != out {
		t.Fatal("second patch must be a no-op")
	}
}

func TestPatchCaddyEncodeUpgradesPartialH2OnlyGate(t *testing.T) {
	in := `example.com {
	# fullboard-h2-ws-begin
	@not_h2_ws not {
		header :protocol *
		method CONNECT
		protocol http/2
	}
	encode @not_h2_ws zstd gzip
	# fullboard-h2-ws-end
}
`
	if !CaddyEncodeNeedsH2WSPatch(in) {
		t.Fatal("partial h2-only gate must still need a fix (classic Upgrade stays compressed)")
	}
	out, changed := PatchCaddyEncodeForH2WS(in)
	if !changed {
		t.Fatal("expected upgrade of partial gate")
	}
	if strings.Contains(out, "encode @not_h2_ws") || activeEncode.MatchString(out) {
		t.Fatalf("active encode survived:\n%s", out)
	}
	if CaddyEncodeNeedsH2WSPatch(out) {
		t.Fatal("upgraded file still needs a fix")
	}
}

func TestPatchCaddyEncodeSkipsAlreadyDisabled(t *testing.T) {
	in := `example.com {
	# fullboard-h2-ws-begin
	# encode disabled: stock encode stalls Telegram web-proxy WebSocket carrier
	# (classic Upgrade /api/v1/ws and h2 CONNECT). HTTPS long-poll unaffected.
	# fullboard-h2-ws-end
}
`
	_, changed := PatchCaddyEncodeForH2WS(in)
	if changed {
		t.Fatal("already-disabled encode must not be rewritten")
	}
}

func TestWrapCaddyWriteErrorHintsSandbox(t *testing.T) {
	err := wrapCaddyWriteError(fmt.Errorf("open tmp: %w", syscall.EROFS))
	if err == nil || !strings.Contains(err.Error(), "ReadWritePaths=-/etc/caddy") {
		t.Fatalf("error = %v, want ReadWritePaths hint", err)
	}
	if !errors.Is(err, syscall.EROFS) {
		t.Fatalf("wrapped error must still match EROFS, got %v", err)
	}
}

func TestApplyCaddyEncodeH2WSPatchRoundTrip(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "Caddyfile")
	if err := os.WriteFile(path, []byte("host {\n\tencode gzip\n}\n"), 0o600); err != nil {
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
	if activeEncode.Match(raw) {
		t.Fatalf("active encode left in file: %s", raw)
	}
	if !strings.Contains(string(raw), "encode disabled") {
		t.Fatalf("file not patched: %s", raw)
	}
	if runtime.GOOS != "windows" {
		st, err := os.Stat(path)
		if err != nil {
			t.Fatal(err)
		}
		if st.Mode().Perm() != 0o640 {
			t.Fatalf("mode = %o, want 0640 (panel UMask must not leave Caddyfile private to root)", st.Mode().Perm())
		}
	}
	changed, err = ApplyCaddyEncodeH2WSPatch(path)
	if err != nil || changed {
		t.Fatalf("second apply: changed=%v err=%v", changed, err)
	}
}
