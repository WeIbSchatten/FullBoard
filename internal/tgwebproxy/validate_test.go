package tgwebproxy

import (
	"strings"
	"testing"
)

func validProfile() RelayProfile {
	return RelayProfile{Name: "default", Secret: "000102030405060708090a0b0c0d0e0f", Backend: "127.0.0.1:2398", CarrierMode: "https"}
}

func TestValidateProfiles(t *testing.T) {
	global := relayDefaults().Limits
	tests := []struct {
		name    string
		mutate  func([]RelayProfile) []RelayProfile
		wantErr string
	}{
		{"valid single profile", func(p []RelayProfile) []RelayProfile { return p }, ""},
		{"backend on a public address", func(p []RelayProfile) []RelayProfile { p[0].Backend = "10.0.0.5:2398"; return p }, "numeric loopback"},
		{"backend by hostname", func(p []RelayProfile) []RelayProfile { p[0].Backend = "localhost:2398"; return p }, "numeric loopback"},
		{"short secret", func(p []RelayProfile) []RelayProfile { p[0].Secret = "0011"; return p }, "32 hex"},
		{"17-byte secret without dd", func(p []RelayProfile) []RelayProfile { p[0].Secret = "ee000102030405060708090a0b0c0d0e0f"; return p }, "dd prefix"},
		{"unknown carrier", func(p []RelayProfile) []RelayProfile { p[0].CarrierMode = "quic"; return p }, "carrier_mode"},
		{"limit above global", func(p []RelayProfile) []RelayProfile {
			p[0].Limits = &RelayProfileLimits{MaxSessions: global.MaxSessionsGlobal + 1}
			return p
		}, "may only lower"},
		{"duplicate name", func(p []RelayProfile) []RelayProfile {
			second := validProfile()
			second.Secret = "ffeeddccbbaa99887766554433221100"
			return append(p, second)
		}, "duplicate profile name"},
		{"secret reused in another case", func(p []RelayProfile) []RelayProfile {
			second := validProfile()
			second.Name = "beta"
			second.Secret = strings.ToUpper(second.Secret)
			return append(p, second)
		}, "share the same secret"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateProfiles(tt.mutate([]RelayProfile{validProfile()}), global)
			if tt.wantErr == "" {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("error = %v, want it to mention %q", err, tt.wantErr)
			}
		})
	}
}

func TestRelayConfigValidateKeepsListenersOnLoopback(t *testing.T) {
	tests := []struct {
		name    string
		mutate  func(*RelayConfig)
		wantErr string
	}{
		{"valid", func(*RelayConfig) {}, ""},
		{"admin exposed on all interfaces", func(c *RelayConfig) { c.AdminListen = "0.0.0.0:8081" }, "admin_listen"},
		{"relay exposed publicly", func(c *RelayConfig) { c.Listen = "[::]:8080" }, "listen"},
		{"public upstream off-host", func(c *RelayConfig) { c.PublicUpstream = "http://192.0.2.10:3000" }, "public_upstream"},
		{"both site sources", func(c *RelayConfig) { c.PublicDir = "/srv/tproxy-site" }, "exactly one"},
		{"uppercase hostname", func(c *RelayConfig) { c.PublicHostname = "Proxy.example.com" }, "lowercase"},
		{"base path with dot segment", func(c *RelayConfig) { c.BasePath = "a/../b" }, "base_path"},
		{"zero timeout", func(c *RelayConfig) { c.Timeouts.LongPoll = "0s" }, "timeouts.long_poll"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := NewRelayConfig()
			cfg.PublicHostname = "proxy.example.com"
			tt.mutate(&cfg)
			err := cfg.Validate()
			if tt.wantErr == "" {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("error = %v, want it to mention %q", err, tt.wantErr)
			}
		})
	}
}
