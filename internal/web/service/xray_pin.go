package service

import (
	"strings"

	"github.com/WeIbSchatten/We1ssBoard/v3/internal/logger"
)

const xrayPinnedVersionKey = "xrayPinnedVersion"

func (s *SettingService) GetXrayPinnedVersion() (string, error) {
	return s.getString(xrayPinnedVersionKey)
}

func (s *SettingService) SetXrayPinnedVersion(version string) error {
	return s.setString(xrayPinnedVersionKey, version)
}

func pinnedXrayNeedsInstall(pin, running string) bool {
	pin = strings.TrimPrefix(strings.TrimSpace(pin), "v")
	return pin != "" && pin != strings.TrimPrefix(strings.TrimSpace(running), "v")
}

// InstallPinnedXray installs version and remembers it, so later panel updates
// (which ship their own bundled core) put it back instead of replacing it.
func (s *ServerService) InstallPinnedXray(version string) error {
	if err := s.UpdateXray(version); err != nil {
		return err
	}
	return s.settingService.SetXrayPinnedVersion(pinFor(version))
}

// pinFor keeps "latest" unpinned: it names no fixed release to restore.
func pinFor(version string) string {
	if strings.EqualFold(strings.TrimSpace(version), "latest") {
		return ""
	}
	return strings.TrimSpace(version)
}

// RestorePinnedXray reinstalls the operator's chosen core when it is not the one
// running, typically right after a panel update replaced it.
func (s *ServerService) RestorePinnedXray() {
	pin, err := s.settingService.GetXrayPinnedVersion()
	if err != nil {
		logger.Warning("xray pin: read setting:", err)
		return
	}
	running := s.xrayService.GetXrayVersion()
	if !pinnedXrayNeedsInstall(pin, running) {
		return
	}
	logger.Infof("xray pin: running %s, restoring pinned %s", running, pin)
	if err := s.UpdateXray(pin); err != nil {
		logger.Warning("xray pin: restore failed:", err)
	}
}
