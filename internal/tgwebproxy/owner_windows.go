package tgwebproxy

import (
	"io/fs"
	"os"
)

func copyOwner(fs.FileInfo, string) {}

func assignServiceGroup(string) {}

// prepareReplace clears the read-only attribute a 0400 file gets on Windows,
// which would otherwise make the atomic rename fail.
func prepareReplace(target string) { _ = os.Chmod(target, 0o600) }
