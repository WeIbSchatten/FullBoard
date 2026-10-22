package service

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/WeIbSchatten/We1ssBoard/v3/internal/util/netsafe"
	"github.com/WeIbSchatten/We1ssBoard/v3/internal/web/runtime"
	"github.com/WeIbSchatten/We1ssBoard/v3/internal/web/session"
)

const enrollInvitePrefix = "fb-enroll-1."

type EnrollInvitePayload struct {
	V    int    `json:"v"`
	Base string `json:"base"`
	Code string `json:"code"`
	// Pin is the hex SHA-256 of the child's TLS leaf certificate, so a master can trust
	// a self-signed child on first contact; empty for http panels or without a cert file.
	Pin string `json:"pin,omitempty"`
}

// enrollRootCAs replaces the system roots in tests; nil means the system pool.
var enrollRootCAs *x509.CertPool

type EnrollInviteResponse struct {
	Invite    string `json:"invite" example:"fb-enroll-1.eyJ2IjoxLCJiYXNlIjoiaHR0cHM6Ly9ldS5leGFtcGxlLmNvbTozMDAwLyIsImNvZGUiOiJhYmMifQ"`
	ExpiresIn int    `json:"expiresIn" example:"1800"`
	BaseURL   string `json:"baseUrl" example:"https://eu.example.com:2053/"`
}

type EnrollConsumeResponse struct {
	Scheme    string `json:"scheme" example:"https"`
	Address   string `json:"address" example:"eu.example.com"`
	Port      int    `json:"port" example:"2053"`
	BasePath  string `json:"basePath" example:"/"`
	ApiToken  string `json:"apiToken" example:"tok_…"`
	PanelGuid string `json:"panelGuid,omitempty" example:""`
	Name      string `json:"name" example:"eu-relay"`
}

type EnrollFromInviteRequest struct {
	Invite string `json:"invite" form:"invite" validate:"required" example:"fb-enroll-1.…"`
	Name   string `json:"name,omitempty" form:"name" example:"eu-relay"`
}

// IssueEnrollInvite builds a pasteable invite blob for a master to enroll this panel.
func (s *SettingService) IssueEnrollInvite(publicBase string) (EnrollInviteResponse, error) {
	base := strings.TrimSpace(publicBase)
	if base == "" {
		var err error
		base, err = s.GuessPanelBaseURL()
		if err != nil {
			return EnrollInviteResponse{}, err
		}
	}
	if !strings.HasSuffix(base, "/") {
		base += "/"
	}
	u, err := url.Parse(base)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return EnrollInviteResponse{}, fmt.Errorf("public base URL must include scheme and host")
	}
	pin := ""
	if u.Scheme == "https" {
		pin = s.panelCertPin()
	}
	code, err := session.IssueEnrollInviteCode(base)
	if err != nil {
		return EnrollInviteResponse{}, err
	}
	raw, err := json.Marshal(EnrollInvitePayload{V: 1, Base: base, Code: code, Pin: pin})
	if err != nil {
		return EnrollInviteResponse{}, err
	}
	return EnrollInviteResponse{
		Invite:    enrollInvitePrefix + base64.RawURLEncoding.EncodeToString(raw),
		ExpiresIn: int(session.EnrollInviteTTL.Seconds()),
		BaseURL:   base,
	}, nil
}

// panelCertPin hashes the leaf of the panel's own certificate file. A panel behind a
// proxy with its own certificate gets no usable pin, and the master falls back to CA checks.
func (s *SettingService) panelCertPin() string {
	file, err := s.GetCertFile()
	if err != nil || strings.TrimSpace(file) == "" {
		return ""
	}
	raw, err := os.ReadFile(file)
	if err != nil {
		return ""
	}
	block, _ := pem.Decode(raw)
	if block == nil || block.Type != "CERTIFICATE" {
		return ""
	}
	sum := sha256.Sum256(block.Bytes)
	return hex.EncodeToString(sum[:])
}

// GuessPanelBaseURL builds https?://domain|listen:port/basePath/ from settings.
func (s *SettingService) GuessPanelBaseURL() (string, error) {
	domain, _ := s.GetWebDomain()
	listen, _ := s.GetListen()
	port, err := s.GetPort()
	if err != nil {
		return "", err
	}
	basePath, err := s.GetBasePath()
	if err != nil {
		return "", err
	}
	cert, _ := s.GetCertFile()
	scheme := "http"
	if strings.TrimSpace(cert) != "" {
		scheme = "https"
	}
	host := strings.TrimSpace(domain)
	if host == "" {
		host = strings.TrimSpace(listen)
	}
	if host == "" || host == "0.0.0.0" || host == "::" {
		return "", fmt.Errorf("set Web Domain (or a non-wildcard listen address) before creating an enroll invite")
	}
	if strings.Contains(host, ":") && !strings.HasPrefix(host, "[") {
		host = "[" + host + "]"
	}
	return fmt.Sprintf("%s://%s:%d%s", scheme, host, port, normalizeEnrollBasePath(basePath)), nil
}

func normalizeEnrollBasePath(p string) string {
	p = strings.TrimSpace(p)
	if p == "" {
		return "/"
	}
	if !strings.HasPrefix(p, "/") {
		p = "/" + p
	}
	if !strings.HasSuffix(p, "/") {
		p += "/"
	}
	return p
}

// ConsumeEnrollInviteCode burns a one-time invite; returns the public base stored at issue.
func (s *SettingService) ConsumeEnrollInviteCode(code string) (string, error) {
	base, ok := session.ConsumeEnrollInviteCode(strings.TrimSpace(code))
	if !ok {
		return "", fmt.Errorf("enroll invite is invalid or expired")
	}
	return base, nil
}

// EnrollConnectionDetails returns this panel's dial address for a minted token.
// preferredBase (from the invite) wins over GuessPanelBaseURL so wildcard listen works.
func (s *SettingService) EnrollConnectionDetails(apiToken, preferredBase string) (EnrollConsumeResponse, error) {
	base := strings.TrimSpace(preferredBase)
	if base == "" {
		var err error
		base, err = s.GuessPanelBaseURL()
		if err != nil {
			return EnrollConsumeResponse{}, err
		}
	}
	if !strings.HasSuffix(base, "/") {
		base += "/"
	}
	u, err := url.Parse(base)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return EnrollConsumeResponse{}, fmt.Errorf("enroll base URL is invalid")
	}
	port := 0
	if u.Port() != "" {
		port, _ = strconv.Atoi(u.Port())
	} else if u.Scheme == "https" {
		port = 443
	} else {
		port = 80
	}
	guid, _ := s.GetPanelGuid()
	return EnrollConsumeResponse{
		Scheme:    u.Scheme,
		Address:   u.Hostname(),
		Port:      port,
		BasePath:  normalizeEnrollBasePath(u.Path),
		ApiToken:  apiToken,
		PanelGuid: guid,
		Name:      u.Hostname(),
	}, nil
}

// ParseEnrollInvite decodes a pasteable invite blob.
func ParseEnrollInvite(invite string) (EnrollInvitePayload, error) {
	invite = strings.TrimSpace(invite)
	if !strings.HasPrefix(invite, enrollInvitePrefix) {
		return EnrollInvitePayload{}, fmt.Errorf("invite must start with %s", enrollInvitePrefix)
	}
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimPrefix(invite, enrollInvitePrefix))
	if err != nil {
		return EnrollInvitePayload{}, fmt.Errorf("decode invite: %w", err)
	}
	var p EnrollInvitePayload
	if err := json.Unmarshal(raw, &p); err != nil {
		return EnrollInvitePayload{}, fmt.Errorf("parse invite: %w", err)
	}
	if p.V != 1 || p.Base == "" || p.Code == "" {
		return EnrollInvitePayload{}, fmt.Errorf("invite payload incomplete")
	}
	return p, nil
}

// EnrollFromInvite calls the child consume endpoint and creates a Node.
func (s *NodeService) EnrollFromInvite(req EnrollFromInviteRequest) (*NodeView, error) {
	payload, err := ParseEnrollInvite(req.Invite)
	if err != nil {
		return nil, err
	}
	base, err := validateEnrollBase(payload.Base)
	if err != nil {
		return nil, err
	}
	consumeURL := base.JoinPath("enroll/consume").String()
	body, _ := json.Marshal(map[string]string{"code": payload.Code})
	httpReq, err := http.NewRequestWithContext(context.Background(), http.MethodPost, consumeURL, strings.NewReader(string(body)))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Requested-With", "XMLHttpRequest")
	pinned := false
	tlsCfg, err := enrollTLSConfig(base.Hostname(), payload.Pin, &pinned)
	if err != nil {
		return nil, err
	}
	client := &http.Client{
		Timeout: 20 * time.Second,
		Transport: &http.Transport{
			DialContext:     netsafe.SSRFGuardedDialContext,
			TLSClientConfig: tlsCfg,
		},
	}
	httpReq = httpReq.WithContext(netsafe.ContextWithAllowPrivate(httpReq.Context(), true))
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("contact child panel: %w", err)
	}
	defer resp.Body.Close()
	var env struct {
		Success bool                  `json:"success"`
		Msg     string                `json:"msg"`
		Obj     EnrollConsumeResponse `json:"obj"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&env); err != nil {
		return nil, fmt.Errorf("decode child response: %w", err)
	}
	if !env.Success || env.Obj.ApiToken == "" {
		msg := env.Msg
		if msg == "" {
			msg = "child refused enroll consume"
		}
		return nil, fmt.Errorf("%s", msg)
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = env.Obj.Name
	}
	if name == "" {
		name = env.Obj.Address
	}
	token := env.Obj.ApiToken
	tlsMode, certPin := "", ""
	if pinned {
		tlsMode, certPin = "pin", payload.Pin
	}
	return s.CreateFromRequest(&NodeMutationRequest{
		TlsVerifyMode:       tlsMode,
		PinnedCertSha256:    certPin,
		Name:                name,
		Scheme:              env.Obj.Scheme,
		Address:             env.Obj.Address,
		Port:                env.Obj.Port,
		BasePath:            env.Obj.BasePath,
		ApiToken:            &token,
		Enable:              true,
		AllowPrivateAddress: true,
		InboundSyncMode:     "all",
	})
}

// validateEnrollBase accepts only a plain http(s) panel address: the invite is pasted
// text, and its base decides where the one-time code and the reply go.
func validateEnrollBase(raw string) (*url.URL, error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return nil, fmt.Errorf("invite address is not a URL: %w", err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return nil, fmt.Errorf("invite address must be http or https, got %q", u.Scheme)
	}
	if u.User != nil || u.RawQuery != "" || u.Fragment != "" || u.Opaque != "" {
		return nil, errors.New("invite address must not carry credentials, a query or a fragment")
	}
	if _, err := netsafe.NormalizeHost(u.Hostname()); err != nil {
		return nil, fmt.Errorf("invite address: %w", err)
	}
	return u, nil
}

// enrollTLSConfig trusts the child when its certificate chains to the system roots or,
// failing that, matches the invite's pin; *pinned reports that only the pin vouched for it.
func enrollTLSConfig(serverName, pin string, pinned *bool) (*tls.Config, error) {
	if pin == "" {
		return &tls.Config{ServerName: serverName, RootCAs: enrollRootCAs, MinVersion: tls.VersionTLS12}, nil
	}
	want, err := runtime.DecodeCertPin(pin)
	if err != nil {
		return nil, fmt.Errorf("invite certificate pin: %w", err)
	}
	return &tls.Config{
		ServerName: serverName,
		MinVersion: tls.VersionTLS12,
		// Chain and pin are both checked in VerifyConnection, so a self-signed child can pass.
		InsecureSkipVerify: true,
		VerifyConnection: func(cs tls.ConnectionState) error {
			if len(cs.PeerCertificates) == 0 {
				return errors.New("child panel presented no certificate")
			}
			opts := x509.VerifyOptions{DNSName: serverName, Roots: enrollRootCAs, Intermediates: x509.NewCertPool()}
			for _, c := range cs.PeerCertificates[1:] {
				opts.Intermediates.AddCert(c)
			}
			if _, err := cs.PeerCertificates[0].Verify(opts); err == nil {
				return nil
			}
			sum := sha256.Sum256(cs.PeerCertificates[0].Raw)
			if subtle.ConstantTimeCompare(sum[:], want) != 1 {
				return errors.New("child panel certificate does not match the invite pin")
			}
			*pinned = true
			return nil
		},
	}, nil
}
