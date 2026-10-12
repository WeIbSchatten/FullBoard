package session

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"io"
	"sync"
	"time"
)

// EnrollInviteTTL is long enough to paste the link on a master panel.
const EnrollInviteTTL = 30 * time.Minute

type enrollInviteStore struct {
	mu      sync.Mutex
	now     func() time.Time
	expires map[[sha256.Size]byte]time.Time
}

func newEnrollInviteStore(now func() time.Time) *enrollInviteStore {
	return &enrollInviteStore{now: now, expires: make(map[[sha256.Size]byte]time.Time)}
}

var enrollInvites = newEnrollInviteStore(time.Now)

// IssueEnrollInviteCode mints a single-use enrollment code.
func IssueEnrollInviteCode() (string, error) { return enrollInvites.issue() }

// ConsumeEnrollInviteCode burns the code and reports whether it was valid.
func ConsumeEnrollInviteCode(code string) bool { return enrollInvites.consume(code) }

func (s *enrollInviteStore) issue() (string, error) {
	raw := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, raw); err != nil {
		return "", err
	}
	code := base64.RawURLEncoding.EncodeToString(raw)
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now()
	for digest, deadline := range s.expires {
		if !now.Before(deadline) {
			delete(s.expires, digest)
		}
	}
	s.expires[sha256.Sum256([]byte(code))] = now.Add(EnrollInviteTTL)
	return code, nil
}

func (s *enrollInviteStore) consume(code string) bool {
	if code == "" {
		return false
	}
	digest := sha256.Sum256([]byte(code))
	s.mu.Lock()
	defer s.mu.Unlock()
	deadline, ok := s.expires[digest]
	if !ok {
		return false
	}
	delete(s.expires, digest)
	return s.now().Before(deadline)
}
