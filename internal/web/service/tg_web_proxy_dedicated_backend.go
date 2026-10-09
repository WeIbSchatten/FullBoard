package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"strings"

	"github.com/WeIbSchatten/FullBoard/v3/internal/database"
	"github.com/WeIbSchatten/FullBoard/v3/internal/database/model"
	"github.com/WeIbSchatten/FullBoard/v3/internal/logger"
	"github.com/WeIbSchatten/FullBoard/v3/internal/tgwebproxy"
)

// Managed dedicated backends are loopback MTProto inbounds owned by a binding.
// Remark is the stable key; no fakeTlsDomain so HealMtprotoClientSecrets leaves
// the plain 32-hex secret alone (tg-web-proxy profiles cannot carry FakeTLS).
const tgWebProxyManagedRemarkPrefix = "fb-tgwp:"

func tgWebProxyManagedRemark(email string) string {
	return tgWebProxyManagedRemarkPrefix + strings.ToLower(strings.TrimSpace(email))
}

func allocateLoopbackPort() (int, error) {
	ln, err := (&net.ListenConfig{}).Listen(context.Background(), "tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	port := ln.Addr().(*net.TCPAddr).Port
	_ = ln.Close()
	return port, nil
}

func loopbackBackend(port int) string {
	return fmt.Sprintf("127.0.0.1:%d", port)
}

// prepareDedicatedSpecs provisions a loopback MTProto listener per dedicated
// binding so each profile secret has a matching backend without a hand-built inbound.
func (s *TgWebProxyService) prepareDedicatedSpecs(rows []tgBindingRow) ([]tgwebproxy.DedicatedSpec, error) {
	if len(rows) == 0 {
		return nil, nil
	}
	snap, err := tgWebProxy().Store().Load()
	if err != nil {
		return nil, err
	}
	byName := make(map[string]tgwebproxy.RelayProfile, len(snap.Profiles))
	for _, p := range snap.Profiles {
		byName[p.Name] = p
	}

	inboundSvc := &InboundService{}
	specs := make([]tgwebproxy.DedicatedSpec, 0, len(rows))
	for _, r := range rows {
		name := r.effectiveProfile()
		secret := ""
		if p, ok := byName[name]; ok {
			secret = p.Secret
		}
		if secret == "" {
			secret, err = tgwebproxy.NewProfileSecret()
			if err != nil {
				return nil, err
			}
		}
		backend, err := ensureTgWebProxyManagedBackend(inboundSvc, r.Email, secret)
		if err != nil {
			return nil, fmt.Errorf("dedicated backend for %s: %w", r.Email, err)
		}
		specs = append(specs, tgwebproxy.DedicatedSpec{
			Email:   r.Email,
			Base:    r.ProfileName,
			Secret:  secret,
			Backend: backend,
		})
	}
	return specs, nil
}

func ensureTgWebProxyManagedBackend(inboundSvc *InboundService, email, secret string) (string, error) {
	email = strings.TrimSpace(email)
	remark := tgWebProxyManagedRemark(email)
	db := database.GetDB()

	var existing model.Inbound
	err := db.Where("remark = ? AND protocol = ?", remark, model.MTProto).First(&existing).Error
	if err == nil {
		if err := syncManagedMtprotoSecret(inboundSvc, &existing, email, secret); err != nil {
			return "", err
		}
		return loopbackBackend(existing.Port), nil
	}

	port, err := allocateLoopbackPort()
	if err != nil {
		return "", err
	}
	// Empty clients first: AddInbound rejects emails that already exist as panel clients.
	created, _, err := inboundSvc.AddInbound(&model.Inbound{
		UserId:   1,
		Remark:   remark,
		Enable:   true,
		Listen:   "127.0.0.1",
		Port:     port,
		Protocol: model.MTProto,
		Settings: `{"clients":[]}`,
	})
	if err != nil {
		return "", err
	}
	if err := syncManagedMtprotoSecret(inboundSvc, created, email, secret); err != nil {
		_, _ = inboundSvc.DelInbound(created.Id)
		return "", err
	}
	logger.Infof("tg-web-proxy: created managed MTProto inbound %d for %s on 127.0.0.1:%d", created.Id, email, port)
	return loopbackBackend(created.Port), nil
}

// syncManagedMtprotoSecret writes settings and links the panel client; starts
// from the full ClientRecord so SyncInbound cannot zero SubID.
func syncManagedMtprotoSecret(inboundSvc *InboundService, ib *model.Inbound, email, secret string) error {
	rec, err := inboundSvc.clientService.GetRecordByEmail(nil, email)
	if err != nil {
		return err
	}
	client := *rec.ToClient()
	client.Secret = secret
	client.Enable = true

	settings, err := json.Marshal(map[string][]model.Client{"clients": {client}})
	if err != nil {
		return err
	}
	ib.Settings = string(settings)
	if err := database.GetDB().Model(&model.Inbound{}).Where("id = ?", ib.Id).Update("settings", ib.Settings).Error; err != nil {
		return err
	}
	return inboundSvc.clientService.SyncInbound(nil, ib.Id, []model.Client{client})
}

func (s *TgWebProxyService) cleanupManagedBackends(wantedEmails map[string]struct{}) {
	db := database.GetDB()
	var rows []model.Inbound
	if err := db.Where("protocol = ? AND remark LIKE ?", model.MTProto, tgWebProxyManagedRemarkPrefix+"%").Find(&rows).Error; err != nil {
		logger.Warning("tg-web-proxy: list managed backends:", err)
		return
	}
	inboundSvc := &InboundService{}
	for i := range rows {
		ib := &rows[i]
		email := strings.TrimPrefix(ib.Remark, tgWebProxyManagedRemarkPrefix)
		if _, ok := wantedEmails[strings.ToLower(email)]; ok {
			continue
		}
		if _, err := inboundSvc.DelInbound(ib.Id); err != nil {
			logger.Warningf("tg-web-proxy: delete managed inbound %d: %v", ib.Id, err)
			continue
		}
		logger.Infof("tg-web-proxy: removed managed MTProto inbound %d for %s", ib.Id, email)
	}
}
