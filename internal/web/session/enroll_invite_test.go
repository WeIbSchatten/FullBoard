package session

import (
	"testing"
	"time"
)

func TestEnrollInviteSingleUseAndExpiry(t *testing.T) {
	now := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	store := newEnrollInviteStore(func() time.Time { return now })
	code, err := store.issue("https://eu.example.com:2053/")
	if err != nil || code == "" {
		t.Fatalf("issue: %q %v", code, err)
	}
	base, ok := store.consume(code)
	if !ok {
		t.Fatal("first consume should succeed")
	}
	if base != "https://eu.example.com:2053/" {
		t.Fatalf("base = %q", base)
	}
	if _, ok := store.consume(code); ok {
		t.Fatal("second consume must fail")
	}
	code2, err := store.issue("https://eu.example.com:2053/")
	if err != nil {
		t.Fatal(err)
	}
	now = now.Add(EnrollInviteTTL + time.Second)
	if _, ok := store.consume(code2); ok {
		t.Fatal("expired code must not consume")
	}
}
