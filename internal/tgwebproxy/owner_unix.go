//go:build !windows

package tgwebproxy

import (
	"fmt"
	"os"
	"os/user"
	"strconv"
)

func prepareReplace(string) {}

// assignServiceGroup sets root:tproxy so the relay service user can read the
// file. Missing group is a no-op (CI/dev); a failed chown is an error — usually
// the panel unit lacks CAP_CHOWN under CapabilityBoundingSet.
func assignServiceGroup(path string) error {
	group, err := user.LookupGroup(serviceGroup)
	if err != nil {
		return nil
	}
	gid, err := strconv.Atoi(group.Gid)
	if err != nil {
		return fmt.Errorf("parse gid for group %q: %w", serviceGroup, err)
	}
	if err := os.Chown(path, 0, gid); err != nil {
		return fmt.Errorf("chown %s root:%s: %w (panel needs CAP_CHOWN in CapabilityBoundingSet)", path, serviceGroup, err)
	}
	return nil
}
