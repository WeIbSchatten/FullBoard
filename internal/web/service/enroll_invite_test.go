package service

import (
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/WeIbSchatten/We1ssBoard/v3/internal/database"
	"github.com/WeIbSchatten/We1ssBoard/v3/internal/database/model"
)

func TestParseEnrollInviteRoundTrip(t *testing.T) {
	payload := EnrollInvitePayload{
		V:    1,
		Base: "https://eu.example.com:2053/",
		Code: "abc123XYZ",
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	invite := enrollInvitePrefix + base64.RawURLEncoding.EncodeToString(raw)
	got, err := ParseEnrollInvite(invite)
	if err != nil {
		t.Fatalf("ParseEnrollInvite: %v", err)
	}
	if got != payload {
		t.Fatalf("got %+v want %+v", got, payload)
	}
}

func TestParseEnrollInviteRejectsBadPrefix(t *testing.T) {
	_, err := ParseEnrollInvite("not-an-invite")
	if err == nil || !strings.Contains(err.Error(), enrollInvitePrefix) {
		t.Fatalf("expected prefix error, got %v", err)
	}
}

func TestParseEnrollInviteRejectsIncomplete(t *testing.T) {
	raw, _ := json.Marshal(EnrollInvitePayload{V: 1, Base: "https://x/", Code: ""})
	invite := enrollInvitePrefix + base64.RawURLEncoding.EncodeToString(raw)
	_, err := ParseEnrollInvite(invite)
	if err == nil {
		t.Fatal("expected incomplete payload error")
	}
}

func certPin(t *testing.T, cert *x509.Certificate) string {
	t.Helper()
	sum := sha256.Sum256(cert.Raw)
	return hex.EncodeToString(sum[:])
}

func inviteFor(t *testing.T, base, pin string) string {
	t.Helper()
	raw, err := json.Marshal(EnrollInvitePayload{V: 1, Base: base, Code: "code-1", Pin: pin})
	if err != nil {
		t.Fatal(err)
	}
	return enrollInvitePrefix + base64.RawURLEncoding.EncodeToString(raw)
}

// childPanel answers enroll/consume like a child panel and counts the requests that got through.
func childPanel(t *testing.T, useTLS bool) (*httptest.Server, *atomic.Int32) {
	t.Helper()
	hits := &atomic.Int32{}
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		if r.URL.Path != "/panel/enroll/consume" {
			http.NotFound(w, r)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"success": true,
			"obj": EnrollConsumeResponse{
				Scheme: "https", Address: "eu.example.com", Port: 2053, BasePath: "/panel/",
				ApiToken: "child-admin-token", Name: "eu-relay",
			},
		})
	})
	var srv *httptest.Server
	if useTLS {
		srv = httptest.NewTLSServer(handler)
	} else {
		srv = httptest.NewServer(handler)
	}
	t.Cleanup(srv.Close)
	return srv, hits
}

// CodeQL #10/#11: the master trusted any TLS certificate while the child handed back an
// admin API token, and dialled whatever URL the invite named.
func TestEnrollFromInviteVerifiesTheChildPanel(t *testing.T) {
	tlsChild, tlsHits := childPanel(t, true)
	plainChild, plainHits := childPanel(t, false)
	trusted := x509.NewCertPool()
	trusted.AddCert(tlsChild.Certificate())
	goodPin := certPin(t, tlsChild.Certificate())
	wrongPin := strings.Repeat("ab", 32)

	cases := []struct {
		name     string
		base     string
		pin      string
		roots    *x509.CertPool
		hits     *atomic.Int32
		wantErr  string
		wantMode string
		wantPin  string
	}{
		{name: "self-signed child with a matching pin is enrolled and kept pinned", base: tlsChild.URL + "/panel/", pin: goodPin, hits: tlsHits, wantMode: "pin", wantPin: goodPin},
		{name: "a certificate the system trusts needs no pin and keeps normal verification", base: tlsChild.URL + "/panel/", roots: trusted, hits: tlsHits, wantMode: "verify"},
		{name: "a trusted certificate wins over a stale pin", base: tlsChild.URL + "/panel/", pin: wrongPin, roots: trusted, hits: tlsHits, wantMode: "verify"},
		{name: "a pin that does not match never sends the code", base: tlsChild.URL + "/panel/", pin: wrongPin, hits: tlsHits, wantErr: "does not match the invite"},
		{name: "an untrusted certificate without a pin never sends the code", base: tlsChild.URL + "/panel/", hits: tlsHits, wantErr: "certificate"},
		{name: "a plain http child is enrolled as before", base: plainChild.URL + "/panel/", hits: plainHits, wantMode: "verify"},
		{name: "a non-http scheme is refused", base: "file:///etc/passwd/", hits: plainHits, wantErr: "invite address"},
		{name: "credentials in the address are refused", base: "http://admin:pw@" + strings.TrimPrefix(plainChild.URL, "http://") + "/panel/", hits: plainHits, wantErr: "invite address"},
		{name: "a query in the address is refused", base: plainChild.URL + "/panel/?next=/x", hits: plainHits, wantErr: "invite address"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			setupBulkDB(t)
			enrollRootCAs = tc.roots
			t.Cleanup(func() { enrollRootCAs = nil })
			before := tc.hits.Load()

			view, err := (&NodeService{}).EnrollFromInvite(EnrollFromInviteRequest{Invite: inviteFor(t, tc.base, tc.pin)})
			if tc.wantErr != "" {
				if err == nil || !strings.Contains(err.Error(), tc.wantErr) {
					t.Fatalf("err = %v, want one containing %q", err, tc.wantErr)
				}
				if got := tc.hits.Load() - before; got != 0 {
					t.Fatalf("child received %d requests, want none: the invite code leaked", got)
				}
				var count int64
				database.GetDB().Model(&model.Node{}).Count(&count)
				if count != 0 {
					t.Fatalf("%d nodes created after a refused enroll", count)
				}
				return
			}
			if err != nil {
				t.Fatalf("EnrollFromInvite: %v", err)
			}
			var n model.Node
			if err := database.GetDB().First(&n, view.Id).Error; err != nil {
				t.Fatalf("load node: %v", err)
			}
			if n.TlsVerifyMode != tc.wantMode || n.PinnedCertSha256 != tc.wantPin {
				t.Fatalf("node tls = %q pin %q, want %q pin %q", n.TlsVerifyMode, n.PinnedCertSha256, tc.wantMode, tc.wantPin)
			}
		})
	}
}

func TestIssueEnrollInviteCarriesTheCertificatePin(t *testing.T) {
	setupBulkDB(t)
	srv := httptest.NewTLSServer(http.NotFoundHandler())
	defer srv.Close()
	certFile := filepath.Join(t.TempDir(), "panel.crt")
	pemBytes := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: srv.Certificate().Raw})
	if err := os.WriteFile(certFile, pemBytes, 0o600); err != nil {
		t.Fatal(err)
	}
	settings := &SettingService{}
	if err := settings.SetCertFile(certFile); err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct{ base, wantPin string }{
		{"https://eu.example.com:2053/panel/", certPin(t, srv.Certificate())},
		{"http://10.0.0.5:2053/", ""},
	} {
		resp, err := settings.IssueEnrollInvite(tc.base)
		if err != nil {
			t.Fatalf("IssueEnrollInvite(%s): %v", tc.base, err)
		}
		got, err := ParseEnrollInvite(resp.Invite)
		if err != nil {
			t.Fatal(err)
		}
		if got.Pin != tc.wantPin {
			t.Fatalf("invite for %s pin = %q, want %q", tc.base, got.Pin, tc.wantPin)
		}
	}
}
