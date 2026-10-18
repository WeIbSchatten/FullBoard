package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"

	"github.com/WeIbSchatten/We1ssBoard/v3/internal/database"
	"github.com/WeIbSchatten/We1ssBoard/v3/internal/database/model"
	"github.com/WeIbSchatten/We1ssBoard/v3/internal/logger"
	"github.com/WeIbSchatten/We1ssBoard/v3/internal/tgwebproxy"
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
	NodeId           *int   `json:"nodeId,omitempty" example:"2"`
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
	NodeId      *int   `json:"nodeId,omitempty" example:"2"`
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
	NodeId      *int
	Enable      bool
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
		NodeId:           r.NodeId,
		EffectiveProfile: r.effectiveProfile(),
	}
}

func tgBindingRows(db *gorm.DB) *gorm.DB {
	return db.Table("client_tg_web_proxy AS b").
		Select("b.client_id AS client_id, c.email AS email, b.profile_name AS profile_name, b.dedicated AS dedicated, b.node_id AS node_id, c.enable AS enable").
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

	var localRows []tgBindingRow
	remoteByNode := map[int][]tgBindingRow{}
	for _, r := range rows {
		if r.NodeId == nil {
			localRows = append(localRows, r)
			continue
		}
		remoteByNode[*r.NodeId] = append(remoteByNode[*r.NodeId], r)
	}

	res, err := tgWebProxy().SyncDedicatedProfiles(ctx, dedicatedSpecs(localRows))
	if err != nil {
		return res, err
	}

	var remoteErrs []string
	for nodeID, nodeRows := range remoteByNode {
		if err := s.syncRemoteDedicated(ctx, nodeID, nodeRows); err != nil {
			remoteErrs = append(remoteErrs, fmt.Sprintf("node %d: %v", nodeID, err))
		}
	}

	s.removeLegacyManagedBackends()

	if len(remoteErrs) > 0 {
		return res, errors.New(strings.Join(remoteErrs, "; "))
	}
	return res, nil
}

func (s *TgWebProxyService) syncRemoteDedicated(ctx context.Context, nodeID int, rows []tgBindingRow) error {
	_, err := (&NodeService{}).SyncRemoteTgWebProxyDedicated(nodeID, dedicatedSpecs(rows))
	return err
}

func (s *TgWebProxyService) ListBindings() (TgWebProxyBindingList, error) {
	var rows []tgBindingRow
	if err := tgBindingRows(database.GetDB()).Scan(&rows).Error; err != nil {
		return TgWebProxyBindingList{}, err
	}
	out := TgWebProxyBindingList{Bindings: make([]TgWebProxyBinding, len(rows)), SyncError: lastTgWebProxySyncError()}
	shares := s.shareMapForRows(rows)
	for i, r := range rows {
		b := r.view()
		if info, ok := shares[shareKey(r)]; ok {
			b.Secret = info.Secret
			b.Link = info.Link
		}
		out.Bindings[i] = b
	}
	return out, nil
}

func shareKey(r tgBindingRow) string {
	node := 0
	if r.NodeId != nil {
		node = *r.NodeId
	}
	return fmt.Sprintf("%d:%s", node, r.effectiveProfile())
}

func (s *TgWebProxyService) shareMapForRows(rows []tgBindingRow) map[string]tgwebproxy.RelayShareInfo {
	out := make(map[string]tgwebproxy.RelayShareInfo, len(rows))
	var localNames []string
	remoteNames := map[int][]string{}
	for _, r := range rows {
		name := r.effectiveProfile()
		if r.NodeId == nil {
			localNames = append(localNames, name)
			continue
		}
		remoteNames[*r.NodeId] = append(remoteNames[*r.NodeId], name)
	}
	if len(localNames) > 0 {
		shares, err := tgWebProxy().ShareProfiles(localNames)
		if err != nil {
			logger.Warning("tg-web-proxy: share bindings:", err)
		} else {
			for name, info := range shares {
				out[fmt.Sprintf("0:%s", name)] = info
			}
		}
	}
	nodeSvc := &NodeService{}
	for nodeID, names := range remoteNames {
		for _, name := range names {
			raw, err := nodeSvc.RemoteTgWebProxyShare(nodeID, name)
			if err != nil {
				logger.Warningf("tg-web-proxy: remote share node %d %s: %v", nodeID, name, err)
				continue
			}
			var info tgwebproxy.RelayShareInfo
			if err := json.Unmarshal(raw, &info); err != nil || info.Link == "" {
				continue
			}
			out[fmt.Sprintf("%d:%s", nodeID, name)] = info
		}
	}
	return out
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
	if req.NodeId != nil {
		if !req.Dedicated {
			return TgWebProxyBinding{}, errors.New("remote tg-web-proxy bindings require dedicated secrets")
		}
		if err := s.validateRemoteBind(*req.NodeId, profile); err != nil {
			return TgWebProxyBinding{}, err
		}
	} else {
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
	}

	var row model.ClientTgWebProxy
	err = db.Where("client_id = ?", rec.Id).First(&row).Error
	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		row = model.ClientTgWebProxy{
			ClientId: rec.Id, ProfileName: profile, Dedicated: req.Dedicated, NodeId: req.NodeId,
		}
		err = db.Create(&row).Error
	case err == nil:
		row.ProfileName, row.Dedicated, row.NodeId = profile, req.Dedicated, req.NodeId
		err = db.Model(&row).Select("ProfileName", "Dedicated", "NodeId").Updates(&row).Error
	}
	if err != nil {
		return TgWebProxyBinding{}, err
	}
	scheduleTgWebProxySync()
	return tgBindingRow{
		ClientId: rec.Id, Email: rec.Email, ProfileName: row.ProfileName,
		Dedicated: row.Dedicated, NodeId: row.NodeId,
	}.view(), nil
}

func (s *TgWebProxyService) validateRemoteBind(nodeID int, profile string) error {
	exists, err := (&NodeService{}).NodeExists(nodeID)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("node %d not found", nodeID)
	}
	raw, err := (&NodeService{}).RemoteTgWebProxySnapshot(nodeID)
	if err != nil {
		return fmt.Errorf("read remote tg-web-proxy: %w", err)
	}
	var snap tgwebproxy.RelaySnapshot
	if err := json.Unmarshal(raw, &snap); err != nil {
		return fmt.Errorf("decode remote tg-web-proxy snapshot: %w", err)
	}
	if !snap.ConfigExists {
		return errors.New("remote tg-web-proxy is not configured yet")
	}
	if !slices.ContainsFunc(snap.Profiles, func(p tgwebproxy.RelayProfile) bool { return p.Name == profile }) {
		return fmt.Errorf("profile %q not found on node %d", profile, nodeID)
	}
	return nil
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
// an unsynced dedicated profile is skipped, never replaced by the shared base secret.
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
	shares := s.shareMapForRows(rows)
	links := make([]TgWebProxyClientLink, 0, len(rows))
	for _, r := range rows {
		if info, ok := shares[shareKey(r)]; ok {
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
// returns how many rows were removed so callers can schedule a sync once.
func deleteClientTgWebProxyBindings(tx *gorm.DB, clientIDs []int) (int64, error) {
	if len(clientIDs) == 0 {
		return 0, nil
	}
	res := tx.Where("client_id IN ?", clientIDs).Delete(&model.ClientTgWebProxy{})
	return res.RowsAffected, res.Error
}
