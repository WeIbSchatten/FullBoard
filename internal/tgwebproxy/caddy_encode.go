package tgwebproxy

import (
	"fmt"
	"os"
	"regexp"
	"strings"
)

// DefaultCaddyfile is the stock path written by the upstream tproxy-server installer.
const DefaultCaddyfile = "/etc/caddy/Caddyfile"

// Marker comments keep the patch idempotent across install/update cycles.
const (
	caddyH2WSBegin = "# fullboard-h2-ws-begin"
	caddyH2WSEnd   = "# fullboard-h2-ws-end"
)

var (
	encodeLine   = regexp.MustCompile(`(?m)^([ \t]*)encode[ \t]+([^\n#]+)`)
	hasH2WSPatch = regexp.MustCompile(`(?m)^\s*@not_h2_ws\b|fullboard-h2-ws-begin`)
)

func bareEncodeArgs(args string) bool {
	args = strings.TrimSpace(args)
	return args != "" && !strings.HasPrefix(args, "@")
}

// CaddyEncodeNeedsH2WSPatch reports whether the Caddyfile still has a bare
// encode that can stall HTTP/2 WebSocket upgrades (caddyserver/caddy#6733).
func CaddyEncodeNeedsH2WSPatch(content string) bool {
	if hasH2WSPatch.FindStringIndex(content) != nil {
		return false
	}
	for _, m := range encodeLine.FindAllStringSubmatch(content, -1) {
		if bareEncodeArgs(m[2]) {
			return true
		}
	}
	return false
}

// PatchCaddyEncodeForH2WS rewrites bare `encode …` lines so HTTP/2 WebSocket
// CONNECT upgrades skip compression. Returns the new content and whether it changed.
func PatchCaddyEncodeForH2WS(content string) (string, bool) {
	if !CaddyEncodeNeedsH2WSPatch(content) {
		return content, false
	}
	replaced := false
	out := encodeLine.ReplaceAllStringFunc(content, func(line string) string {
		m := encodeLine.FindStringSubmatch(line)
		if m == nil || !bareEncodeArgs(m[2]) {
			return line
		}
		indent, args := m[1], strings.TrimSpace(m[2])
		replaced = true
		return indent + caddyH2WSBegin + "\n" +
			indent + "@not_h2_ws not {\n" +
			indent + "\theader :protocol *\n" +
			indent + "\tmethod CONNECT\n" +
			indent + "\tprotocol http/2\n" +
			indent + "}\n" +
			indent + "encode @not_h2_ws " + args + "\n" +
			indent + caddyH2WSEnd
	})
	return out, replaced
}

// CaddyH2WSStatus describes whether the stock Caddyfile needs the encode patch.
type CaddyH2WSStatus struct {
	Path      string `json:"path" example:"/etc/caddy/Caddyfile"`
	Exists    bool   `json:"exists" example:"true"`
	NeedsFix  bool   `json:"needsFix" example:"true"`
	LastError string `json:"lastError,omitempty" example:""`
}

func inspectCaddyEncode(path string) CaddyH2WSStatus {
	st := CaddyH2WSStatus{Path: path}
	raw, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return st
		}
		st.LastError = err.Error()
		return st
	}
	st.Exists = true
	st.NeedsFix = CaddyEncodeNeedsH2WSPatch(string(raw))
	return st
}

// ApplyCaddyEncodeH2WSPatch writes the patched Caddyfile. Caller reloads caddy.
func ApplyCaddyEncodeH2WSPatch(path string) (changed bool, err error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return false, err
	}
	next, changed := PatchCaddyEncodeForH2WS(string(raw))
	if !changed {
		return false, nil
	}
	tmp := path + ".fullboard-tmp"
	if err := os.WriteFile(tmp, []byte(next), 0o644); err != nil {
		return false, err
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return false, fmt.Errorf("replace Caddyfile: %w", err)
	}
	return true, nil
}
