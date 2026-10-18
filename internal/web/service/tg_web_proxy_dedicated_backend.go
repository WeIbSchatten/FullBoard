package service

import (
	"strings"

	"github.com/WeIbSchatten/We1ssBoard/v3/internal/database"
	"github.com/WeIbSchatten/We1ssBoard/v3/internal/database/model"
	"github.com/WeIbSchatten/We1ssBoard/v3/internal/logger"
	"github.com/WeIbSchatten/We1ssBoard/v3/internal/tgwebproxy"
)

// Legacy dedicated backends were mtg inbounds remarked fb-tgwp:<email>; mtg only
// takes FakeTLS secrets, so they never served the relay. Syncs now remove them.
const tgWebProxyManagedRemarkPrefix = "fb-tgwp:"

// dedicatedSpecs maps bindings to relay specs; the relay host allocates the
// MTProxy backend and keeps disabled clients parked instead of dropping them.
func dedicatedSpecs(rows []tgBindingRow) []tgwebproxy.DedicatedSpec {
	specs := make([]tgwebproxy.DedicatedSpec, 0, len(rows))
	for _, r := range rows {
		specs = append(specs, tgwebproxy.DedicatedSpec{Email: r.Email, Base: r.ProfileName, Suspended: !r.Enable})
	}
	return specs
}

func (s *TgWebProxyService) removeLegacyManagedBackends() {
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
		if _, err := inboundSvc.DelInbound(ib.Id); err != nil {
			logger.Warningf("tg-web-proxy: delete managed inbound %d: %v", ib.Id, err)
			continue
		}
		logger.Infof("tg-web-proxy: removed legacy mtg inbound %d for %s", ib.Id, email)
	}
}
