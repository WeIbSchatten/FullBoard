package session

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"io"
	"sync"
	"time"
)

// LoginTicketTTL is short on purpose: the ticket travels in a URL fragment and
// must be dead before it can be replayed from browser history or a screenshot.
const LoginTicketTTL = 45 * time.Second

// loginTicketStore keeps only SHA-256 digests, so a memory dump never yields a
// redeemable ticket. In-memory: a panel restart invalidates pending tickets.
type loginTicketStore struct {
	mu      sync.Mutex
	now     func() time.Time
	expires map[[sha256.Size]byte]time.Time
}

func newLoginTicketStore(now func() time.Time) *loginTicketStore {
	return &loginTicketStore{now: now, expires: make(map[[sha256.Size]byte]time.Time)}
}

var loginTickets = newLoginTicketStore(time.Now)

// IssueLoginTicket mints a single-use ticket redeemable for LoginTicketTTL.
func IssueLoginTicket() (string, error) { return loginTickets.issue() }

// ConsumeLoginTicket burns the ticket and reports whether it was valid.
func ConsumeLoginTicket(ticket string) bool { return loginTickets.consume(ticket) }

func (s *loginTicketStore) issue() (string, error) {
	raw := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, raw); err != nil {
		return "", err
	}
	ticket := base64.RawURLEncoding.EncodeToString(raw)
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now()
	for digest, deadline := range s.expires {
		if !now.Before(deadline) {
			delete(s.expires, digest)
		}
	}
	s.expires[sha256.Sum256([]byte(ticket))] = now.Add(LoginTicketTTL)
	return ticket, nil
}

func (s *loginTicketStore) consume(ticket string) bool {
	if ticket == "" {
		return false
	}
	digest := sha256.Sum256([]byte(ticket))
	s.mu.Lock()
	defer s.mu.Unlock()
	deadline, ok := s.expires[digest]
	if !ok {
		return false
	}
	delete(s.expires, digest)
	return s.now().Before(deadline)
}

func (s *loginTicketStore) size() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.expires)
}
