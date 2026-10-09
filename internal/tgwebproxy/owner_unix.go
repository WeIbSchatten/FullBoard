//go:build !windows

package tgwebproxy

import (
	"io/fs"
	"os"
	"os/user"
	"strconv"
	"syscall"
)

func copyOwner(info fs.FileInfo, path string) {
	if st, ok := info.Sys().(*syscall.Stat_t); ok {
		_ = os.Chown(path, int(st.Uid), int(st.Gid))
	}
}

func prepareReplace(string) {}

// assignServiceGroup gives a brand-new file root:tproxy so the relay's service
// user can read config.json, matching the upstream installer.
func assignServiceGroup(path string) {
	group, err := user.LookupGroup(serviceGroup)
	if err != nil {
		return
	}
	if gid, err := strconv.Atoi(group.Gid); err == nil {
		_ = os.Chown(path, 0, gid)
	}
}
