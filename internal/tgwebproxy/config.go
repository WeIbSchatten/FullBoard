// Package tgwebproxy manages a host-local tproxy-server (Telegram WEB proxy
// relay): its config.json, profiles.json, systemd units and admin probes.
package tgwebproxy

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// MaxCarrierBatchBytes mirrors the relay's 2 MiB desktop loopback message cap.
const MaxCarrierBatchBytes = 2 * 1024 * 1024

const maxBasePathLength = 128

var basePathPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_-]*(/[A-Za-z0-9][A-Za-z0-9_-]*)*$`)

type RelayLimits struct {
	MaxHeaderBytes            int `json:"max_header_bytes" example:"16384"`
	MaxBodyBytes              int `json:"max_body_bytes" example:"2097152"`
	MaxFramePayload           int `json:"max_frame_payload" example:"1048576"`
	CarrierBatchBytes         int `json:"carrier_batch_bytes" example:"2097152"`
	MaxStreamsPerSession      int `json:"max_streams_per_session" example:"128"`
	MaxClosedStreamIDs        int `json:"max_closed_stream_ids" example:"4096"`
	MaxPendingPerSession      int `json:"max_pending_per_session" example:"33554432"`
	MaxPendingGlobal          int `json:"max_pending_global" example:"536870912"`
	MaxPendingItemsPerSession int `json:"max_pending_items_per_session" example:"16384"`
	MaxPendingItemsGlobal     int `json:"max_pending_items_global" example:"262144"`
	MaxSessionsPerIP          int `json:"max_sessions_per_ip" example:"0"`
	MaxSessionsGlobal         int `json:"max_sessions_global" example:"128"`
	MaxStreamsGlobal          int `json:"max_streams_global" example:"4096"`
	MaxBackendDialsInFlight   int `json:"max_backend_dials_in_flight" example:"256"`
	NewSessionsPerMinute      int `json:"new_sessions_per_minute" example:"600"`
	NewSessionsBurst          int `json:"new_sessions_burst" example:"128"`
	NewStreamsPerMinute       int `json:"new_streams_per_minute" example:"6000"`
	NewStreamsBurst           int `json:"new_streams_burst" example:"512"`
	MaxBootstrapsPerIP        int `json:"max_bootstraps_per_ip" example:"0"`
	MaxBootstrapsGlobal       int `json:"max_bootstraps_global" example:"512"`
	NewBootstrapsPerMinute    int `json:"new_bootstraps_per_minute" example:"1200"`
	NewBootstrapsBurst        int `json:"new_bootstraps_burst" example:"256"`
	MaxProfiles               int `json:"max_profiles" example:"32"`
}

type RelayTimeouts struct {
	BackendDial       string `json:"backend_dial" example:"5s"`
	LongPoll          string `json:"long_poll" example:"25s"`
	ReconnectGrace    string `json:"reconnect_grace" example:"2m"`
	BootstrapLifetime string `json:"bootstrap_lifetime" example:"2m"`
	ReadHeader        string `json:"read_header" example:"10s"`
	Idle              string `json:"idle" example:"75s"`
	Shutdown          string `json:"shutdown" example:"15s"`
}

// RelayConfig is the on-disk config.json. Every known key is always written so
// a merge over the previous file can clear a value (e.g. switch public_dir off).
type RelayConfig struct {
	PublicHostname string        `json:"public_hostname" example:"proxy.example.com"`
	BasePath       string        `json:"base_path" example:""`
	Listen         string        `json:"listen" example:"127.0.0.1:8080"`
	AdminListen    string        `json:"admin_listen" example:"127.0.0.1:8081"`
	PublicDir      string        `json:"public_dir" example:""`
	PublicUpstream string        `json:"public_upstream" example:"http://127.0.0.1:3000"`
	StaticRoutes   string        `json:"static_routes" example:"exact"`
	TokenKeyFile   string        `json:"token_key_file" example:"/etc/tproxy-server/token.key"`
	ProfilesFile   string        `json:"profiles_file" example:"/run/credentials/tproxy-server.service/profiles.json"`
	EnablePprof    bool          `json:"enable_pprof" example:"false"`
	Limits         RelayLimits   `json:"limits"`
	Timeouts       RelayTimeouts `json:"timeouts"`
}

// relayDefaults mirrors the relay's own config.Defaults(): keys absent from an
// existing file take these values, exactly as the relay itself would.
func relayDefaults() RelayConfig {
	return RelayConfig{
		Listen:       "127.0.0.1:8080",
		AdminListen:  "127.0.0.1:8081",
		StaticRoutes: "legacy",
		TokenKeyFile: "token.key",
		Limits: RelayLimits{
			MaxHeaderBytes:            16 * 1024,
			MaxBodyBytes:              2 * 1024 * 1024,
			MaxFramePayload:           1024 * 1024,
			CarrierBatchBytes:         2 * 1024 * 1024,
			MaxStreamsPerSession:      128,
			MaxClosedStreamIDs:        4096,
			MaxPendingPerSession:      32 * 1024 * 1024,
			MaxPendingGlobal:          512 * 1024 * 1024,
			MaxPendingItemsPerSession: 16 * 1024,
			MaxPendingItemsGlobal:     256 * 1024,
			MaxSessionsGlobal:         128,
			MaxStreamsGlobal:          4096,
			MaxBackendDialsInFlight:   256,
			NewSessionsPerMinute:      600,
			NewSessionsBurst:          128,
			NewStreamsPerMinute:       6000,
			NewStreamsBurst:           512,
			MaxBootstrapsGlobal:       512,
			NewBootstrapsPerMinute:    1200,
			NewBootstrapsBurst:        256,
			MaxProfiles:               32,
		},
		Timeouts: RelayTimeouts{
			BackendDial:       "5s",
			LongPoll:          "25s",
			ReconnectGrace:    "2m",
			BootstrapLifetime: "2m",
			ReadHeader:        "10s",
			Idle:              "75s",
			Shutdown:          "15s",
		},
	}
}

// NewRelayConfig is the starting point for a host that has no config.json yet;
// it matches the layout the upstream installer writes.
func NewRelayConfig() RelayConfig {
	cfg := relayDefaults()
	cfg.StaticRoutes = "exact"
	cfg.TokenKeyFile = "/etc/tproxy-server/token.key"
	cfg.ProfilesFile = "/run/credentials/tproxy-server.service/profiles.json"
	cfg.PublicUpstream = "http://127.0.0.1:3000"
	return cfg
}

// ParseRelayConfig decodes config.json over the relay defaults. Unknown keys are
// tolerated here and preserved on write by mergeConfigJSON.
func ParseRelayConfig(raw []byte) (RelayConfig, error) {
	cfg := relayDefaults()
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return RelayConfig{}, fmt.Errorf("decode config.json: %w", err)
	}
	return cfg, nil
}

// Validate enforces the security-relevant subset of the relay's own checks; the
// authoritative full check is `tproxy-server -check`, run before every commit.
func (c RelayConfig) Validate() error {
	if err := ValidateHostname(c.PublicHostname); err != nil {
		return fmt.Errorf("public_hostname: %w", err)
	}
	if c.BasePath != "" {
		if len(c.BasePath) > maxBasePathLength || !basePathPattern.MatchString(c.BasePath) {
			return errors.New("base_path: segments must match [A-Za-z0-9][A-Za-z0-9_-]* joined by / (max 128 chars)")
		}
	}
	if err := ValidateLoopbackAddress(c.Listen); err != nil {
		return fmt.Errorf("listen: %w", err)
	}
	if err := ValidateLoopbackAddress(c.AdminListen); err != nil {
		return fmt.Errorf("admin_listen: %w", err)
	}
	if c.Listen == c.AdminListen {
		return errors.New("listen and admin_listen must differ")
	}
	if (c.PublicDir == "") == (c.PublicUpstream == "") {
		return errors.New("exactly one of public_dir or public_upstream is required")
	}
	if c.PublicUpstream != "" {
		if err := validatePublicUpstream(c.PublicUpstream); err != nil {
			return fmt.Errorf("public_upstream: %w", err)
		}
	}
	if c.StaticRoutes != "exact" && c.StaticRoutes != "legacy" {
		return errors.New("static_routes must be exact or legacy")
	}
	if strings.TrimSpace(c.TokenKeyFile) == "" {
		return errors.New("token_key_file is required")
	}
	if strings.TrimSpace(c.ProfilesFile) == "" {
		return errors.New("profiles_file is required")
	}
	if c.Limits.CarrierBatchBytes > MaxCarrierBatchBytes {
		return errors.New("limits.carrier_batch_bytes must not exceed 2 MiB")
	}
	if c.Limits.MaxProfiles <= 0 {
		return errors.New("limits.max_profiles must be positive")
	}
	timeouts := map[string]string{
		"backend_dial":       c.Timeouts.BackendDial,
		"long_poll":          c.Timeouts.LongPoll,
		"reconnect_grace":    c.Timeouts.ReconnectGrace,
		"bootstrap_lifetime": c.Timeouts.BootstrapLifetime,
		"read_header":        c.Timeouts.ReadHeader,
		"idle":               c.Timeouts.Idle,
		"shutdown":           c.Timeouts.Shutdown,
	}
	for name, value := range timeouts {
		d, err := time.ParseDuration(value)
		if err != nil || d <= 0 {
			return fmt.Errorf("timeouts.%s must be a positive duration such as \"5s\"", name)
		}
	}
	return nil
}

// ValidateHostname accepts only a lowercase ASCII (IDNA A-label) DNS name.
func ValidateHostname(host string) error {
	if host == "" || len(host) > 253 || strings.HasSuffix(host, ".") || strings.ContainsAny(host, ":/@?#[] ") {
		return errors.New("must be a DNS hostname without scheme, port, path, query or trailing dot")
	}
	if net.ParseIP(host) != nil || !strings.Contains(host, ".") {
		return errors.New("IP addresses and single-label names are not allowed")
	}
	for _, label := range strings.Split(host, ".") {
		if label == "" || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
			return errors.New("invalid DNS label")
		}
		for _, ch := range label {
			if (ch < 'a' || ch > 'z') && (ch < '0' || ch > '9') && ch != '-' {
				return errors.New("must be lowercase ASCII (use the xn-- form for IDN)")
			}
		}
	}
	return nil
}

// ValidateLoopbackAddress requires a numeric loopback host:port, the only form
// the relay accepts for its listeners and backends.
func ValidateLoopbackAddress(address string) error {
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return fmt.Errorf("must be host:port: %w", err)
	}
	ip := net.ParseIP(host)
	if ip == nil || !ip.IsLoopback() {
		return errors.New("must use a numeric loopback address such as 127.0.0.1")
	}
	value, err := strconv.Atoi(port)
	if err != nil || value < 1 || value > 65535 {
		return errors.New("invalid port")
	}
	return nil
}

func validatePublicUpstream(raw string) error {
	parsed, err := url.Parse(raw)
	if err != nil {
		return err
	}
	if parsed.Scheme != "http" {
		return errors.New("must use http:// on a numeric loopback address")
	}
	if parsed.User != nil || parsed.Path != "" || parsed.RawQuery != "" || parsed.Fragment != "" {
		return errors.New("must contain only scheme, loopback address and port")
	}
	return ValidateLoopbackAddress(parsed.Host)
}

// mergeConfigJSON overlays the known keys of cfg onto the previous file so keys
// this panel does not model (newer relay versions) survive an edit.
func mergeConfigJSON(previous []byte, cfg RelayConfig) ([]byte, error) {
	updated, err := json.Marshal(cfg)
	if err != nil {
		return nil, err
	}
	var next map[string]any
	if err := json.Unmarshal(updated, &next); err != nil {
		return nil, err
	}
	if len(bytes.TrimSpace(previous)) > 0 {
		var base map[string]any
		if err := json.Unmarshal(previous, &base); err == nil {
			next = overlay(base, next)
		}
	}
	out, err := json.MarshalIndent(next, "", "  ")
	if err != nil {
		return nil, err
	}
	return append(out, '\n'), nil
}

func overlay(base, top map[string]any) map[string]any {
	for key, value := range top {
		topChild, topIsMap := value.(map[string]any)
		baseChild, baseIsMap := base[key].(map[string]any)
		if topIsMap && baseIsMap {
			base[key] = overlay(baseChild, topChild)
			continue
		}
		base[key] = value
	}
	return base
}
