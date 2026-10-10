package service

import (
	"context"
	"io"
	"path/filepath"
	"strings"
	"sync"

	"github.com/WeIbSchatten/FullBoard/v3/internal/config"
	"github.com/WeIbSchatten/FullBoard/v3/internal/tgwebproxy"
)

// TgWebProxyService manages the host-local tproxy-server. It is deliberately
// not dispatched through runtime.Runtime: the relay is not a node-synced object.
type TgWebProxyService struct{}

var (
	tgWebProxyMu      sync.Mutex
	tgWebProxyManager *tgwebproxy.Manager
)

func tgWebProxy() *tgwebproxy.Manager {
	tgWebProxyMu.Lock()
	defer tgWebProxyMu.Unlock()
	if tgWebProxyManager == nil {
		paths := tgwebproxy.DefaultPaths(filepath.Join(config.GetLogFolder(), "tg-web-proxy"))
		tgWebProxyManager = tgwebproxy.NewManager(paths, nil)
	}
	return tgWebProxyManager
}

// UseTgWebProxyManager swaps the relay manager so tests in other packages can
// point the service at a throwaway directory; the returned func restores it.
func UseTgWebProxyManager(m *tgwebproxy.Manager) (restore func()) {
	tgWebProxyMu.Lock()
	prev := tgWebProxyManager
	tgWebProxyManager = m
	tgWebProxyMu.Unlock()
	return func() {
		cancelTgWebProxySync()
		tgWebProxyMu.Lock()
		tgWebProxyManager = prev
		tgWebProxyMu.Unlock()
	}
}

type TgWebProxyConfigRequest struct {
	Config         tgwebproxy.RelayConfig   `json:"config"`
	InitialProfile *tgwebproxy.RelayProfile `json:"initialProfile,omitempty"`
}

func (s *TgWebProxyService) Status(ctx context.Context) tgwebproxy.RelayStatus {
	return tgWebProxy().Status(ctx)
}

func (s *TgWebProxyService) Snapshot() (tgwebproxy.RelaySnapshot, error) {
	return tgWebProxy().Store().Load()
}

func (s *TgWebProxyService) SaveConfig(ctx context.Context, req TgWebProxyConfigRequest) (tgwebproxy.RelayApplyResult, error) {
	return tgWebProxy().SaveConfig(ctx, req.Config, req.InitialProfile)
}

func (s *TgWebProxyService) Check(ctx context.Context) error {
	return tgWebProxy().Store().Check(ctx)
}

func (s *TgWebProxyService) FixCaddyEncode(ctx context.Context) (bool, error) {
	return tgWebProxy().FixCaddyEncode(ctx)
}

func (s *TgWebProxyService) AddProfile(ctx context.Context, p tgwebproxy.RelayProfile) (tgwebproxy.RelayApplyResult, error) {
	return tgWebProxy().AddProfile(ctx, p)
}

func (s *TgWebProxyService) UpdateProfile(ctx context.Context, name string, p tgwebproxy.RelayProfile) (tgwebproxy.RelayApplyResult, error) {
	if strings.TrimSpace(p.Name) != name {
		if err := ensureTgWebProxyProfileUnbound(name); err != nil {
			return tgwebproxy.RelayApplyResult{}, err
		}
	}
	res, err := tgWebProxy().UpdateProfile(ctx, name, p)
	if err != nil {
		return res, err
	}
	if cloned, derr := dedicatedBindingsUse(name); derr == nil && cloned {
		scheduleTgWebProxySync()
	}
	return res, nil
}

func (s *TgWebProxyService) DeleteProfile(ctx context.Context, name string) (tgwebproxy.RelayApplyResult, error) {
	if err := ensureTgWebProxyProfileUnbound(name); err != nil {
		return tgwebproxy.RelayApplyResult{}, err
	}
	return tgWebProxy().DeleteProfile(ctx, name)
}

func (s *TgWebProxyService) Share(name string) (tgwebproxy.RelayShareInfo, error) {
	return tgWebProxy().Share(name)
}

func (s *TgWebProxyService) ControlUnit(ctx context.Context, unit, action string) error {
	return tgWebProxy().ControlUnit(ctx, unit, action)
}

func (s *TgWebProxyService) Logs(ctx context.Context, unit string, lines int) (string, error) {
	return tgWebProxy().Logs(ctx, unit, lines)
}

func (s *TgWebProxyService) Install(ctx context.Context, req tgwebproxy.RelayInstallRequest) (tgwebproxy.RelayJobStatus, error) {
	return tgWebProxy().StartInstall(ctx, req)
}

func (s *TgWebProxyService) Update(ctx context.Context) (tgwebproxy.RelayJobStatus, error) {
	return tgWebProxy().StartUpdate(ctx)
}

func (s *TgWebProxyService) Job(ctx context.Context) tgwebproxy.RelayJobStatus {
	return tgWebProxy().JobStatus(ctx)
}

func (s *TgWebProxyService) GetPublicSite() (tgwebproxy.PublicSiteSnapshot, error) {
	return tgWebProxy().GetPublicSite()
}

func (s *TgWebProxyService) PutPublicSiteIndex(ctx context.Context, html string) (tgwebproxy.RelayApplyResult, error) {
	return tgWebProxy().PutPublicSiteIndex(ctx, html)
}

func (s *TgWebProxyService) ResetPublicSite(ctx context.Context) (tgwebproxy.RelayApplyResult, error) {
	return tgWebProxy().ResetPublicSite(ctx)
}

func (s *TgWebProxyService) UploadPublicSiteAsset(name string, r io.Reader, size int64) error {
	return tgWebProxy().UploadPublicSiteAsset(name, r, size)
}

func (s *TgWebProxyService) DeletePublicSiteAsset(name string) error {
	return tgWebProxy().DeletePublicSiteAsset(name)
}
