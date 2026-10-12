package session

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"io"
	"strings"
	"sync"
	"time"
)

// EnrollInviteTTL is long enough to paste the link on a master panel.
const EnrollInviteTTL = 30 * time.Minute

type enrollInviteEntry struct {
	expires time.Time
	base    string
}

type enrollInviteStore struct {
	mu      sync.Mutex
	now     func() time.Time
	entries map[[sha256.Size]byte]enrollInviteEntry
}

func newEnrollInviteStore(now func() time.Time) *enrollInviteStore {
	return &enrollInviteStore{now: now, entries: make(map[[sha256.Size]byte]enrollInviteEntry)}
}

var enrollInvites = newEnrollInviteStore(time.Now)

// IssueEnrollInviteCode mints a single-use enrollment code bound to publicBase.
func IssueEnrollInviteCode(publicBase string) (string, error) {
	return enrollInvites.issue(publicBase)
}

// ConsumeEnrollInviteCode burns the code and returns the base URL stored at issue time.
func ConsumeEnrollInviteCode(code string) (base string, ok bool) {
	return enrollInvites.consume(code)
}

func (s *enrollInviteStore) issue(publicBase string) (string, error) {
	raw := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, raw); err != nil {
		return "", err
	}
	code := base64.RawURLEncoding.EncodeToString(raw)
	base := strings.TrimSpace(publicBase)
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now()
	for digest, entry := range s.entries {
		if !now.Before(entry.expires) {
			delete(s.entries, digest)
		}
	}
	s.entries[sha256.Sum256([]byte(code))] = enrollInviteEntry{
		expires: now.Add(EnrollInviteTTL),
		base:    base,
	}
	return code, nil
}

func (s *enrollInviteStore) consume(code string) (string, bool) {
	if code == "" {
		return "", false
	}
	digest := sha256.Sum256([]byte(code))
	s.mu.Lock()
	defer s.mu.Unlock()
	entry, ok := s.entries[digest]
	if !ok {
		return "", false
	}
	delete(s.entries, digest)
	if !s.now().Before(entry.expires) {
		return "", false
	}
	return entry.base, true
}
