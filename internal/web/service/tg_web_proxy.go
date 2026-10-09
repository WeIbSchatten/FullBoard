package service

import (
	"context"
	"path/filepath"
	"sync"

	"github.com/WeIbSchatten/FullBoard/v3/internal/config"
	"github.com/WeIbSchatten/FullBoard/v3/internal/tgwebproxy"
)

// TgWebProxyService manages the host-local tproxy-server. It is deliberately
// not dispatched through runtime.Runtime: the relay is not a node-synced object.
type TgWebProxyService struct{}

var (
	tgWebProxyOnce    sync.Once
	tgWebProxyManager *tgwebproxy.Manager
)

func tgWebProxy() *tgwebproxy.Manager {
	tgWebProxyOnce.Do(func() {
		paths := tgwebproxy.DefaultPaths(filepath.Join(config.GetLogFolder(), "tg-web-proxy"))
		tgWebProxyManager = tgwebproxy.NewManager(paths, nil)
	})
	return tgWebProxyManager
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

func (s *TgWebProxyService) AddProfile(ctx context.Context, p tgwebproxy.RelayProfile) (tgwebproxy.RelayApplyResult, error) {
	return tgWebProxy().AddProfile(ctx, p)
}

func (s *TgWebProxyService) UpdateProfile(ctx context.Context, name string, p tgwebproxy.RelayProfile) (tgwebproxy.RelayApplyResult, error) {
	return tgWebProxy().UpdateProfile(ctx, name, p)
}

func (s *TgWebProxyService) DeleteProfile(ctx context.Context, name string) (tgwebproxy.RelayApplyResult, error) {
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
