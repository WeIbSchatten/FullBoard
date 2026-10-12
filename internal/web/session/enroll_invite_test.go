package session

import (
	"testing"
	"time"
)

func TestEnrollInviteSingleUseAndExpiry(t *testing.T) {
	now := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	store := newEnrollInviteStore(func() time.Time { return now })
	code, err := store.issue()
	if err != nil || code == "" {
		t.Fatalf("issue: %q %v", code, err)
	}
	if !store.consume(code) {
		t.Fatal("first consume should succeed")
	}
	if store.consume(code) {
		t.Fatal("second consume must fail")
	}
	code2, err := store.issue()
	if err != nil {
		t.Fatal(err)
	}
	now = now.Add(EnrollInviteTTL + time.Second)
	if store.consume(code2) {
		t.Fatal("expired code must not consume")
	}
}
