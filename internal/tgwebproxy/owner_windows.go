package tgwebproxy

import "os"

func assignServiceGroup(string) error { return nil }

// prepareReplace clears the read-only attribute a 0400 file gets on Windows,
// which would otherwise make the atomic rename fail.
func prepareReplace(target string) { _ = os.Chmod(target, 0o600) }
