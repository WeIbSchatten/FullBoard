package tgwebproxy

import (
	"bytes"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"unicode"
)

var CarrierModes = []string{"https", "https-lanes", "websocket", "websocket-lanes"}

// RelayProfileLimits may only lower the global ceilings; zero inherits the global value.
type RelayProfileLimits struct {
	MaxSessions             int `json:"max_sessions,omitempty" example:"32"`
	MaxStreams              int `json:"max_streams,omitempty" example:"512"`
	MaxBackendDialsInFlight int `json:"max_backend_dials_in_flight,omitempty" example:"64"`
	NewSessionsPerMinute    int `json:"new_sessions_per_minute,omitempty" example:"120"`
	NewSessionsBurst        int `json:"new_sessions_burst,omitempty" example:"32"`
	NewStreamsPerMinute     int `json:"new_streams_per_minute,omitempty" example:"1200"`
	NewStreamsBurst         int `json:"new_streams_burst,omitempty" example:"128"`
	MaxStreamsPerSession    int `json:"max_streams_per_session,omitempty" example:"32"`
	MaxPendingPerSession    int `json:"max_pending_per_session,omitempty" example:"8388608"`
}

type RelayProfile struct {
	Name        string              `json:"name" example:"default"`
	Secret      string              `json:"secret" example:"000102030405060708090a0b0c0d0e0f"`
	Backend     string              `json:"backend" example:"127.0.0.1:2398"`
	CarrierMode string              `json:"carrier_mode,omitempty" example:"https"`
	Limits      *RelayProfileLimits `json:"limits,omitempty"`
}

type profilesFile struct {
	Profiles []RelayProfile `json:"profiles"`
}

func ParseProfiles(raw []byte) ([]RelayProfile, error) {
	var file profilesFile
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&file); err != nil {
		return nil, fmt.Errorf("decode profiles.json: %w", err)
	}
	if file.Profiles == nil {
		file.Profiles = []RelayProfile{}
	}
	return file.Profiles, nil
}

func encodeProfiles(profiles []RelayProfile) ([]byte, error) {
	out, err := json.MarshalIndent(profilesFile{Profiles: profiles}, "", "  ")
	if err != nil {
		return nil, err
	}
	return append(out, '\n'), nil
}

// NormalizeProfile canonicalises user input: trimmed name, lowercase hex secret.
func NormalizeProfile(p RelayProfile) RelayProfile {
	p.Name = strings.TrimSpace(p.Name)
	p.Secret = strings.TrimSpace(p.Secret)
	if isHex(p.Secret) {
		p.Secret = strings.ToLower(p.Secret)
	}
	p.Backend = strings.TrimSpace(p.Backend)
	p.CarrierMode = strings.TrimSpace(p.CarrierMode)
	if p.Limits != nil && *p.Limits == (RelayProfileLimits{}) {
		p.Limits = nil
	}
	return p
}

// ValidateProfiles mirrors the relay's profile rules and additionally rejects a
// reused secret, which the relay reports only as a duplicate capability.
func ValidateProfiles(profiles []RelayProfile, global RelayLimits) error {
	if len(profiles) == 0 {
		return errors.New("at least one profile is required")
	}
	if global.MaxProfiles > 0 && len(profiles) > global.MaxProfiles {
		return fmt.Errorf("at most %d profiles are allowed (limits.max_profiles)", global.MaxProfiles)
	}
	names := map[string]struct{}{}
	secrets := map[string]string{}
	for _, p := range profiles {
		if err := validateProfileName(p.Name); err != nil {
			return err
		}
		if _, dup := names[p.Name]; dup {
			return fmt.Errorf("duplicate profile name %q", p.Name)
		}
		names[p.Name] = struct{}{}
		secret, err := DecodeSecret(p.Secret)
		if err != nil {
			return fmt.Errorf("profile %q: %w", p.Name, err)
		}
		key := hex.EncodeToString(secret)
		if other, dup := secrets[key]; dup {
			return fmt.Errorf("profiles %q and %q share the same secret", other, p.Name)
		}
		secrets[key] = p.Name
		if err := ValidateLoopbackAddress(p.Backend); err != nil {
			return fmt.Errorf("profile %q backend: %w", p.Name, err)
		}
		if p.CarrierMode != "" && !isCarrierMode(p.CarrierMode) {
			return fmt.Errorf("profile %q carrier_mode must be one of %s", p.Name, strings.Join(CarrierModes, ", "))
		}
		if p.Limits != nil {
			if err := validateProfileLimits(*p.Limits, global); err != nil {
				return fmt.Errorf("profile %q: %w", p.Name, err)
			}
		}
	}
	return nil
}

func validateProfileName(name string) error {
	if name == "" || len(name) > 64 {
		return errors.New("profile name must contain 1-64 characters")
	}
	for _, r := range name {
		if unicode.IsControl(r) || r == '/' {
			return fmt.Errorf("profile name %q must not contain control characters or '/'", name)
		}
	}
	return nil
}

func validateProfileLimits(v RelayProfileLimits, g RelayLimits) error {
	checks := []struct {
		name         string
		value, limit int
	}{
		{"max_sessions", v.MaxSessions, g.MaxSessionsGlobal},
		{"max_streams", v.MaxStreams, g.MaxStreamsGlobal},
		{"max_backend_dials_in_flight", v.MaxBackendDialsInFlight, g.MaxBackendDialsInFlight},
		{"new_sessions_per_minute", v.NewSessionsPerMinute, g.NewSessionsPerMinute},
		{"new_sessions_burst", v.NewSessionsBurst, g.NewSessionsBurst},
		{"new_streams_per_minute", v.NewStreamsPerMinute, g.NewStreamsPerMinute},
		{"new_streams_burst", v.NewStreamsBurst, g.NewStreamsBurst},
		{"max_streams_per_session", v.MaxStreamsPerSession, g.MaxStreamsPerSession},
		{"max_pending_per_session", v.MaxPendingPerSession, g.MaxPendingPerSession},
	}
	for _, c := range checks {
		if c.value < 0 {
			return fmt.Errorf("limits.%s must not be negative", c.name)
		}
		if c.value > c.limit {
			return fmt.Errorf("limits.%s (%d) may only lower the global value (%d)", c.name, c.value, c.limit)
		}
	}
	return nil
}

func isCarrierMode(mode string) bool {
	for _, m := range CarrierModes {
		if m == mode {
			return true
		}
	}
	return false
}

func isHex(s string) bool {
	if s == "" {
		return false
	}
	_, err := hex.DecodeString(s)
	return err == nil
}

// DecodeSecret follows the relay: 32/34 hex chars, else base64url, yielding 16
// bytes or 17 bytes with the 0xdd prefix.
func DecodeSecret(value string) ([]byte, error) {
	value = strings.TrimSpace(value)
	var decoded []byte
	var err error
	if len(value) == 32 || len(value) == 34 {
		decoded, err = hex.DecodeString(value)
	} else {
		for _, enc := range []*base64.Encoding{base64.RawURLEncoding, base64.URLEncoding} {
			if decoded, err = enc.DecodeString(value); err == nil {
				break
			}
		}
	}
	if err != nil || (len(decoded) != 16 && len(decoded) != 17) {
		return nil, errors.New("secret must be 32 hex characters (16 bytes), optionally prefixed with dd")
	}
	if len(decoded) == 17 && decoded[0] != 0xdd {
		return nil, errors.New("a 17-byte secret must use the dd prefix")
	}
	return decoded, nil
}
