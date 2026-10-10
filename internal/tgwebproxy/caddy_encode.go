package tgwebproxy

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"os/user"
	"regexp"
	"strconv"
	"strings"
	"syscall"
)

// DefaultCaddyfile is the stock path written by the upstream tproxy-server installer.
const DefaultCaddyfile = "/etc/caddy/Caddyfile"

// Marker comments keep the patch idempotent across install/update cycles.
const (
	caddyH2WSBegin = "# fullboard-h2-ws-begin"
	caddyH2WSEnd   = "# fullboard-h2-ws-end"
	caddyFileMode  = 0o640
	caddyGroupName = "caddy"
)

var (
	encodeLine = regexp.MustCompile(`(?m)^([ \t]*)encode[ \t]+([^\n#]+)`)
	// Active encode still applies compression; marker-only "disabled" blocks are fine.
	hasWSSafeEncode = regexp.MustCompile(`(?m)^\s*# fullboard-h2-ws-begin[\s\S]*?# fullboard-h2-ws-end`)
	activeEncode    = regexp.MustCompile(`(?m)^[ \t]*encode[ \t]+`)
)

func bareEncodeArgs(args string) bool {
	args = strings.TrimSpace(args)
	return args != "" && !strings.HasPrefix(args, "@")
}

// CaddyEncodeNeedsH2WSPatch reports whether the Caddyfile still has an active
// encode that can stall Telegram web-proxy WebSocket (classic Upgrade on
// /api/v1/ws and h2 CONNECT — caddyserver/caddy#6733).
func CaddyEncodeNeedsH2WSPatch(content string) bool {
	if hasWSSafeEncode.FindStringIndex(content) != nil && !activeEncode.MatchString(content) {
		return false
	}
	for _, m := range encodeLine.FindAllStringSubmatch(content, -1) {
		if bareEncodeArgs(m[2]) || strings.HasPrefix(strings.TrimSpace(m[2]), "@") {
			return true
		}
	}
	return false
}

// PatchCaddyEncodeForH2WS disables stock `encode` (commented marker block).
// Gating encode for only h2 CONNECT still left classic Upgrade /api/v1/ws
// compressed; dropping encode is the reliable fix for the Telegram carrier.
func PatchCaddyEncodeForH2WS(content string) (string, bool) {
	if !CaddyEncodeNeedsH2WSPatch(content) {
		return content, false
	}
	disabled := caddyH2WSBegin + "\n" +
		"# encode disabled: stock encode stalls Telegram web-proxy WebSocket carrier\n" +
		"# (classic Upgrade /api/v1/ws and h2 CONNECT). HTTPS long-poll unaffected.\n" +
		caddyH2WSEnd

	// Replace a previous marker block (partial h2-only patch) in place.
	if hasWSSafeEncode.FindStringIndex(content) != nil {
		out := hasWSSafeEncode.ReplaceAllStringFunc(content, func(block string) string {
			indent := ""
			if i := strings.IndexFunc(block, func(r rune) bool { return r != ' ' && r != '\t' }); i > 0 {
				indent = block[:i]
			}
			var b strings.Builder
			for _, line := range strings.Split(disabled, "\n") {
				b.WriteString(indent)
				b.WriteString(line)
				b.WriteByte('\n')
			}
			return strings.TrimSuffix(b.String(), "\n")
		})
		// Drop any leftover active encode lines outside the block.
		out2 := encodeLine.ReplaceAllStringFunc(out, func(line string) string {
			m := encodeLine.FindStringSubmatch(line)
			if m == nil {
				return line
			}
			return m[1] + "# encode removed for websocket"
		})
		return out2, out2 != content
	}

	replaced := false
	out := encodeLine.ReplaceAllStringFunc(content, func(line string) string {
		m := encodeLine.FindStringSubmatch(line)
		if m == nil {
			return line
		}
		indent := m[1]
		replaced = true
		var b strings.Builder
		for _, l := range strings.Split(disabled, "\n") {
			b.WriteString(indent)
			b.WriteString(l)
			b.WriteByte('\n')
		}
		return strings.TrimSuffix(b.String(), "\n")
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

// ApplyCaddyEncodeH2WSPatch writes the patched Caddyfile as root:caddy 0640.
// The panel's UMask=0077 would otherwise leave 0600 root:root and the caddy
// service user cannot open it (permission denied → crash loop).
func ApplyCaddyEncodeH2WSPatch(path string) (changed bool, err error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return false, wrapCaddyWriteError(err)
	}
	next, changed := PatchCaddyEncodeForH2WS(string(raw))
	if !changed {
		// Still repair ownership if a previous write left the file unreadable.
		if herr := hardenCaddyfilePerms(path); herr != nil {
			return false, wrapCaddyWriteError(herr)
		}
		return false, nil
	}
	backup := path + ".fullboard-prev"
	_ = os.WriteFile(backup, raw, caddyFileMode)
	_ = hardenCaddyfilePerms(backup)

	tmp := path + ".fullboard-tmp"
	if err := os.WriteFile(tmp, []byte(next), caddyFileMode); err != nil {
		return false, wrapCaddyWriteError(err)
	}
	if err := hardenCaddyfilePerms(tmp); err != nil {
		_ = os.Remove(tmp)
		return false, wrapCaddyWriteError(err)
	}
	if err := ValidateCaddyfile(tmp); err != nil {
		_ = os.Remove(tmp)
		return false, err
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return false, wrapCaddyWriteError(fmt.Errorf("replace Caddyfile: %w", err))
	}
	if err := hardenCaddyfilePerms(path); err != nil {
		return true, wrapCaddyWriteError(err)
	}
	return true, nil
}

// hardenCaddyfilePerms forces 0640 root:caddy so UMask=0077 cannot lock caddy out.
func hardenCaddyfilePerms(path string) error {
	if err := os.Chmod(path, caddyFileMode); err != nil {
		return err
	}
	grp, err := user.LookupGroup(caddyGroupName)
	if err != nil {
		// Non-Linux / missing group: mode alone is still better than 0600.
		return nil
	}
	gid, err := strconv.Atoi(grp.Gid)
	if err != nil {
		return nil
	}
	return os.Chown(path, 0, gid)
}

// ValidateCaddyfile runs `caddy validate` when the binary is on PATH.
func ValidateCaddyfile(path string) error {
	bin, err := exec.LookPath("caddy")
	if err != nil {
		return nil
	}
	out, err := exec.Command(bin, "validate", "--config", path).CombinedOutput()
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = err.Error()
		}
		return fmt.Errorf("caddy validate: %s", msg)
	}
	return nil
}

func wrapCaddyWriteError(err error) error {
	if err == nil {
		return nil
	}
	msg := strings.ToLower(err.Error())
	if errors.Is(err, syscall.EROFS) || strings.Contains(msg, "read-only file system") {
		return fmt.Errorf("%w; add ReadWritePaths=-/etc/caddy to fullboard.service (or a drop-in under fullboard.service.d/) and restart the panel", err)
	}
	return err
}
