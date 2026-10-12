package service

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"
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
