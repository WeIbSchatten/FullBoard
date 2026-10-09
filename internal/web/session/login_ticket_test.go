package session

import (
	"testing"
	"time"
)

func TestLoginTicketIsSingleUse(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	store := newLoginTicketStore(func() time.Time { return now })

	ticket, err := store.issue()
	if err != nil {
		t.Fatal(err)
	}
	if !store.consume(ticket) {
		t.Fatal("fresh ticket was refused")
	}
	if store.consume(ticket) {
		t.Fatal("ticket redeemed twice")
	}
}

func TestLoginTicketExpiresAtTTL(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	store := newLoginTicketStore(func() time.Time { return now })

	justInside, _ := store.issue()
	now = now.Add(LoginTicketTTL - time.Second)
	if !store.consume(justInside) {
		t.Fatal("ticket refused before its TTL elapsed")
	}

	expired, _ := store.issue()
	now = now.Add(LoginTicketTTL)
	if store.consume(expired) {
		t.Fatal("ticket accepted at its TTL")
	}
}

func TestLoginTicketRejectsUnknownAndEmpty(t *testing.T) {
	store := newLoginTicketStore(time.Now)
	issued, _ := store.issue()
	for _, bad := range []string{"", "nope", issued + "x"} {
		if store.consume(bad) {
			t.Fatalf("consume(%q) = true, want false", bad)
		}
	}
	if !store.consume(issued) {
		t.Fatal("a rejected guess burned the genuine ticket")
	}
}

func TestLoginTicketIssuePrunesExpired(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	store := newLoginTicketStore(func() time.Time { return now })
	for range 5 {
		if _, err := store.issue(); err != nil {
			t.Fatal(err)
		}
	}
	now = now.Add(LoginTicketTTL + time.Second)
	if _, err := store.issue(); err != nil {
		t.Fatal(err)
	}
	if got := store.size(); got != 1 {
		t.Fatalf("store holds %d tickets after expiry, want only the new one", got)
	}
}
