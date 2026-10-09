package service

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"

	"github.com/WeIbSchatten/FullBoard/v3/internal/database"
	"github.com/WeIbSchatten/FullBoard/v3/internal/database/model"
	"github.com/WeIbSchatten/FullBoard/v3/internal/logger"
	"github.com/WeIbSchatten/FullBoard/v3/internal/tgwebproxy"
)

// tgWebProxySyncDelay coalesces a burst of bind/unbind calls into one write of
// profiles.json, which restarts the relay.
var tgWebProxySyncDelay = 2 * time.Second

var tgWebProxySync struct {
	sync.Mutex
	timer   *time.Timer
	lastErr string
	// run serialises syncs so a stale spec list can never overwrite a newer one.
	run sync.Mutex
}

type TgWebProxyBinding struct {
	ClientId         int    `json:"clientId" example:"7"`
	Email            string `json:"email" example:"alice"`
	ProfileName      string `json:"profileName" example:"default"`
	Dedicated        bool   `json:"dedicated" example:"false"`
	EffectiveProfile string `json:"effectiveProfile" example:"default"`
	// Secret/Link are filled from the live relay profile when available.
	Secret string `json:"secret,omitempty" example:"000102030405060708090a0b0c0d0e0f"`
	Link   string `json:"link,omitempty" example:"https://t.me/webproxy?server=proxy.example.com&secret=000102030405060708090a0b0c0d0e0f"`
}

type TgWebProxyBindingList struct {
	Bindings []TgWebProxyBinding `json:"bindings"`
	// SyncError is the last failure of the background profile sync, "" when it succeeded.
	SyncError string `json:"syncError" example:""`
}

type TgWebProxyBindRequest struct {
	Email       string `json:"email" validate:"required" example:"alice"`
	ProfileName string `json:"profileName" validate:"required" example:"default"`
	Dedicated   bool   `json:"dedicated" example:"false"`
}

type TgWebProxyUnbindRequest struct {
	Email string `json:"email" validate:"required" example:"alice"`
}

// TgWebProxyClientLink is one bound client's link for the raw subscription.
type TgWebProxyClientLink struct {
	Email string
	Link  string
}

type tgBindingRow struct {
	ClientId    int
	Email       string
	ProfileName string
	Dedicated   bool
}

func (r tgBindingRow) effectiveProfile() string {
	if r.Dedicated {
		return tgwebproxy.DedicatedProfileName(r.Email)
	}
	return r.ProfileName
}

func (r tgBindingRow) view() TgWebProxyBinding {
	return TgWebProxyBinding{
		ClientId:         r.ClientId,
		Email:            r.Email,
		ProfileName:      r.ProfileName,
		Dedicated:        r.Dedicated,
		EffectiveProfile: r.effectiveProfile(),
	}
}

func tgBindingRows(db *gorm.DB) *gorm.DB {
	return db.Table("client_tg_web_proxy AS b").
		Select("b.client_id AS client_id, c.email AS email, b.profile_name AS profile_name, b.dedicated AS dedicated").
		Joins("JOIN clients c ON c.id = b.client_id").
		Order("b.id ASC")
}

func scheduleTgWebProxySync() {
	tgWebProxySync.Lock()
	defer tgWebProxySync.Unlock()
	if tgWebProxySync.timer != nil {
		tgWebProxySync.timer.Stop()
	}
	tgWebProxySync.timer = time.AfterFunc(tgWebProxySyncDelay, func() {
		if database.GetDB() == nil {
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()
		if _, err := (&TgWebProxyService{}).SyncBindings(ctx); err != nil {
			logger.Warning("tg-web-proxy binding sync:", err)
		}
	})
}

func cancelTgWebProxySync() {
	tgWebProxySync.Lock()
	defer tgWebProxySync.Unlock()
	if tgWebProxySync.timer != nil {
		tgWebProxySync.timer.Stop()
		tgWebProxySync.timer = nil
	}
}

func recordTgWebProxySync(err error) {
	tgWebProxySync.Lock()
	defer tgWebProxySync.Unlock()
	tgWebProxySync.lastErr = ""
	if err != nil {
		tgWebProxySync.lastErr = err.Error()
	}
}

func lastTgWebProxySyncError() string {
	tgWebProxySync.Lock()
	defer tgWebProxySync.Unlock()
	return tgWebProxySync.lastErr
}

// SyncBindings drops bindings of deleted clients and makes the relay's per-client
// profiles match the dedicated bindings; the relay restarts only on a real change.
func (s *TgWebProxyService) SyncBindings(ctx context.Context) (tgwebproxy.RelayApplyResult, error) {
	tgWebProxySync.run.Lock()
	defer tgWebProxySync.run.Unlock()
	res, err := s.syncBindingsLocked(ctx)
	recordTgWebProxySync(err)
	return res, err
}

func (s *TgWebProxyService) syncBindingsLocked(ctx context.Context) (tgwebproxy.RelayApplyResult, error) {
	db := database.GetDB()
	orphans := db.Model(&model.ClientRecord{}).Select("id")
	if err := db.Where("client_id NOT IN (?)", orphans).Delete(&model.ClientTgWebProxy{}).Error; err != nil {
		return tgwebproxy.RelayApplyResult{}, err
	}
	var rows []tgBindingRow
	if err := tgBindingRows(db).Where("b.dedicated = ?", true).Scan(&rows).Error; err != nil {
		return tgwebproxy.RelayApplyResult{}, err
	}
	specs, err := s.prepareDedicatedSpecs(rows)
	if err != nil {
		return tgwebproxy.RelayApplyResult{}, err
	}
	res, err := tgWebProxy().SyncDedicatedProfiles(ctx, specs)
	if err != nil {
		return res, err
	}
	wanted := make(map[string]struct{}, len(rows))
	for _, r := range rows {
		wanted[strings.ToLower(r.Email)] = struct{}{}
	}
	s.cleanupManagedBackends(wanted)
	return res, nil
}

func (s *TgWebProxyService) ListBindings() (TgWebProxyBindingList, error) {
	var rows []tgBindingRow
	if err := tgBindingRows(database.GetDB()).Scan(&rows).Error; err != nil {
		return TgWebProxyBindingList{}, err
	}
	out := TgWebProxyBindingList{Bindings: make([]TgWebProxyBinding, len(rows)), SyncError: lastTgWebProxySyncError()}
	names := make([]string, len(rows))
	for i, r := range rows {
		names[i] = r.effectiveProfile()
	}
	shares, shareErr := tgWebProxy().ShareProfiles(names)
	if shareErr != nil {
		logger.Warning("tg-web-proxy: share bindings:", shareErr)
	}
	for i, r := range rows {
		b := r.view()
		if info, ok := shares[r.effectiveProfile()]; ok {
			b.Secret = info.Secret
			b.Link = info.Link
		}
		out.Bindings[i] = b
	}
	return out, nil
}

func clientRecordByEmail(db *gorm.DB, email string) (model.ClientRecord, error) {
	var rec model.ClientRecord
	err := db.Where("lower(email) = ?", strings.ToLower(email)).First(&rec).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return rec, fmt.Errorf("client %q not found", email)
	}
	return rec, err
}

// BindClient points a client at an existing relay profile; the per-client profile
// of a dedicated binding is created by the debounced sync, not here.
func (s *TgWebProxyService) BindClient(req TgWebProxyBindRequest) (TgWebProxyBinding, error) {
	email := strings.TrimSpace(req.Email)
	profile := strings.TrimSpace(req.ProfileName)
	db := database.GetDB()
	rec, err := clientRecordByEmail(db, email)
	if err != nil {
		return TgWebProxyBinding{}, err
	}
	if tgwebproxy.IsManagedProfileName(profile) {
		return TgWebProxyBinding{}, fmt.Errorf("profile %q is managed by client bindings and cannot be bound", profile)
	}
	snap, err := tgWebProxy().Store().Load()
	if err != nil {
		return TgWebProxyBinding{}, err
	}
	if !snap.ConfigExists {
		return TgWebProxyBinding{}, errors.New("tg-web-proxy is not configured yet; save the relay configuration first")
	}
	if !slices.ContainsFunc(snap.Profiles, func(p tgwebproxy.RelayProfile) bool { return p.Name == profile }) {
		return TgWebProxyBinding{}, fmt.Errorf("profile %q not found", profile)
	}

	var row model.ClientTgWebProxy
	err = db.Where("client_id = ?", rec.Id).First(&row).Error
	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		row = model.ClientTgWebProxy{ClientId: rec.Id, ProfileName: profile, Dedicated: req.Dedicated}
		err = db.Create(&row).Error
	case err == nil:
		row.ProfileName, row.Dedicated = profile, req.Dedicated
		err = db.Model(&row).Updates(map[string]any{"profile_name": profile, "dedicated": req.Dedicated}).Error
	}
	if err != nil {
		return TgWebProxyBinding{}, err
	}
	scheduleTgWebProxySync()
	return tgBindingRow{ClientId: rec.Id, Email: rec.Email, ProfileName: row.ProfileName, Dedicated: row.Dedicated}.view(), nil
}

// UnbindClient is idempotent: an unknown client or a client without a binding is a no-op.
func (s *TgWebProxyService) UnbindClient(email string) error {
	db := database.GetDB()
	var rec model.ClientRecord
	err := db.Where("lower(email) = ?", strings.ToLower(strings.TrimSpace(email))).First(&rec).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	res := db.Where("client_id = ?", rec.Id).Delete(&model.ClientTgWebProxy{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected > 0 {
		scheduleTgWebProxySync()
	}
	return nil
}

// ClientLinksBySubId lists enabled bound clients whose profile exists on the relay;
// an unsynced dedicated profile is skipped, never replaced by the shared secret.
func (s *TgWebProxyService) ClientLinksBySubId(subId string) ([]TgWebProxyClientLink, error) {
	if subId == "" {
		return nil, nil
	}
	var rows []tgBindingRow
	err := tgBindingRows(database.GetDB()).
		Where("c.sub_id = ? AND c.enable = ?", subId, true).
		Scan(&rows).Error
	if err != nil || len(rows) == 0 {
		return nil, err
	}
	names := make([]string, len(rows))
	for i, r := range rows {
		names[i] = r.effectiveProfile()
	}
	shares, err := tgWebProxy().ShareProfiles(names)
	if err != nil {
		return nil, err
	}
	links := make([]TgWebProxyClientLink, 0, len(rows))
	for _, r := range rows {
		if info, ok := shares[r.effectiveProfile()]; ok {
			links = append(links, TgWebProxyClientLink{Email: r.Email, Link: info.Link})
		}
	}
	return links, nil
}

func ensureTgWebProxyProfileUnbound(name string) error {
	var n int64
	err := database.GetDB().Model(&model.ClientTgWebProxy{}).Where("profile_name = ?", name).Count(&n).Error
	if err != nil {
		return err
	}
	if n > 0 {
		return fmt.Errorf("profile %q is bound to %d client(s); unbind them first", name, n)
	}
	return nil
}

func dedicatedBindingsUse(profile string) (bool, error) {
	var n int64
	err := database.GetDB().Model(&model.ClientTgWebProxy{}).
		Where("profile_name = ? AND dedicated = ?", profile, true).Count(&n).Error
	return n > 0, err
}

// deleteClientTgWebProxyBindings runs inside the client-delete transactions and
// returns how many bindings went, so callers sync the relay only when needed.
func deleteClientTgWebProxyBindings(tx *gorm.DB, clientIds []int) (int64, error) {
	var total int64
	for _, batch := range chunkInts(clientIds, sqlInChunk) {
		res := tx.Where("client_id IN ?", batch).Delete(&model.ClientTgWebProxy{})
		if res.Error != nil {
			return total, res.Error
		}
		total += res.RowsAffected
	}
	return total, nil
}
