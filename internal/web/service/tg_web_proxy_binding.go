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

// TgWebProxyBindManyRequest adds one relay profile to several clients' subscriptions at once.
type TgWebProxyBindManyRequest struct {
	Emails      []string `json:"emails" validate:"required,min=1,dive,required" example:"[\"alice\",\"bob\"]"`
	ProfileName string   `json:"profileName" validate:"required" example:"default"`
	Dedicated   bool     `json:"dedicated" example:"true"`
	NodeId      *int     `json:"nodeId,omitempty" example:"2"`
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

	res, err := tgWebProxy().SyncDedicatedProfiles(ctx, tgwebproxy.LocalDedicatedOwner, dedicatedSpecs(localRows))
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
	out, err := s.BindClients(TgWebProxyBindManyRequest{
		Emails: []string{req.Email}, ProfileName: req.ProfileName, Dedicated: req.Dedicated, NodeId: req.NodeId,
	})
	if err != nil {
		return TgWebProxyBinding{}, err
	}
	return out[0], nil
}

// BindClients binds every listed client in one transaction: an unknown email
// rejects the whole batch so no subscription is left half-updated.
func (s *TgWebProxyService) BindClients(req TgWebProxyBindManyRequest) ([]TgWebProxyBinding, error) {
	if len(req.Emails) == 0 {
		return nil, errors.New("no clients to bind")
	}
	profile := strings.TrimSpace(req.ProfileName)
	db := database.GetDB()
	for _, email := range req.Emails {
		if _, err := clientRecordByEmail(db, strings.TrimSpace(email)); err != nil {
			return nil, err
		}
	}
	if err := s.validateBindTarget(profile, req.Dedicated, req.NodeId); err != nil {
		return nil, err
	}
	out := make([]TgWebProxyBinding, 0, len(req.Emails))
	err := db.Transaction(func(tx *gorm.DB) error {
		for _, email := range req.Emails {
			rec, err := clientRecordByEmail(tx, strings.TrimSpace(email))
			if err != nil {
				return err
			}
			row, err := upsertTgWebProxyBinding(tx, rec.Id, profile, req.Dedicated, req.NodeId)
			if err != nil {
				return err
			}
			out = append(out, tgBindingRow{
				ClientId: rec.Id, Email: rec.Email, ProfileName: row.ProfileName,
				Dedicated: row.Dedicated, NodeId: row.NodeId,
			}.view())
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	scheduleTgWebProxySync()
	return out, nil
}

func (s *TgWebProxyService) validateBindTarget(profile string, dedicated bool, nodeID *int) error {
	if tgwebproxy.IsManagedProfileName(profile) {
		return fmt.Errorf("profile %q is managed by client bindings and cannot be bound", profile)
	}
	if nodeID != nil {
		if !dedicated {
			return errors.New("remote tg-web-proxy bindings require dedicated secrets")
		}
		return s.validateRemoteBind(*nodeID, profile)
	}
	snap, err := tgWebProxy().Store().Load()
	if err != nil {
		return err
	}
	if !snap.ConfigExists {
		return errors.New("tg-web-proxy is not configured yet; save the relay configuration first")
	}
	if !slices.ContainsFunc(snap.Profiles, func(p tgwebproxy.RelayProfile) bool { return p.Name == profile }) {
		return fmt.Errorf("profile %q not found", profile)
	}
	return nil
}

func upsertTgWebProxyBinding(tx *gorm.DB, clientID int, profile string, dedicated bool, nodeID *int) (model.ClientTgWebProxy, error) {
	var row model.ClientTgWebProxy
	err := tx.Where("client_id = ?", clientID).First(&row).Error
	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		row = model.ClientTgWebProxy{ClientId: clientID, ProfileName: profile, Dedicated: dedicated, NodeId: nodeID}
		err = tx.Create(&row).Error
	case err == nil:
		row.ProfileName, row.Dedicated, row.NodeId = profile, dedicated, nodeID
		err = tx.Model(&row).Select("ProfileName", "Dedicated", "NodeId").Updates(&row).Error
	}
	return row, err
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

// ensureTgWebProxyProfileUnbound checks one relay, the master's own (nodeID nil)
// or a node's: profile names repeat across relays.
func ensureTgWebProxyProfileUnbound(nodeID *int, name string) error {
	var n int64
	err := bindingsOnRelay(nodeID).Where("profile_name = ?", name).Count(&n).Error
	if err != nil {
		return err
	}
	if n > 0 {
		return fmt.Errorf("profile %q is bound to %d client(s); unbind them first", name, n)
	}
	return nil
}

func dedicatedBindingsUse(nodeID *int, profile string) (bool, error) {
	var n int64
	err := bindingsOnRelay(nodeID).Where("profile_name = ? AND dedicated = ?", profile, true).Count(&n).Error
	return n > 0, err
}

func bindingsOnRelay(nodeID *int) *gorm.DB {
	q := database.GetDB().Model(&model.ClientTgWebProxy{})
	if nodeID == nil {
		return q.Where("node_id IS NULL")
	}
	return q.Where("node_id = ?", *nodeID)
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

// LocalBindingCounts counts clients per profile of this panel's own relay.
func (s *TgWebProxyService) LocalBindingCounts() (map[string]int, error) {
	var rows []struct {
		ProfileName string
		N           int
	}
	err := bindingsOnRelay(nil).Select("profile_name, count(*) AS n").Group("profile_name").Scan(&rows).Error
	out := make(map[string]int, len(rows))
	for _, r := range rows {
		out[r.ProfileName] = r.N
	}
	return out, err
}

// SyncError is the last background binding sync failure, "" after a success.
func (s *TgWebProxyService) SyncError() string {
	return lastTgWebProxySyncError()
}
