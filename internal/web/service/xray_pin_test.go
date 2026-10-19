package service

import "testing"

// A panel update ships its own Xray and used to silently replace the version the
// operator chose, e.g. v26.7.28 kept for clients without X25519MLKEM768.
func TestPinnedXrayNeedsInstall(t *testing.T) {
	cases := []struct {
		name, pin, running string
		want               bool
	}{
		{"no pin follows the bundled core", "", "26.10.10", false},
		{"update replaced the pinned core", "v26.7.28", "26.10.10", true},
		{"pinned core already running", "v26.7.28", "26.7.28", false},
		{"pin written without the v prefix", "26.7.28", "26.7.28", false},
		{"core not started yet", "v26.7.28", "Unknown", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := pinnedXrayNeedsInstall(tc.pin, tc.running); got != tc.want {
				t.Fatalf("pinnedXrayNeedsInstall(%q, %q) = %v, want %v", tc.pin, tc.running, got, tc.want)
			}
		})
	}
}

func TestPinForLatestStaysUnpinned(t *testing.T) {
	if got := pinFor("latest"); got != "" {
		t.Fatalf("pinFor(latest) = %q; a pin that never matches a running version would reinstall on every start", got)
	}
	if got := pinFor(" v26.7.28 "); got != "v26.7.28" {
		t.Fatalf("pinFor = %q, want v26.7.28", got)
	}
}
