package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"slices"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/WeIbSchatten/FullBoard/v3/internal/database"
	"github.com/WeIbSchatten/FullBoard/v3/internal/database/model"
	"github.com/WeIbSchatten/FullBoard/v3/internal/logger"
	"github.com/WeIbSchatten/FullBoard/v3/internal/web/runtime"
)

const (
	remoteControlTimeout = 15 * time.Second
	// remoteSlowControlTimeout covers Xray/geo downloads on the node and
	// database transfers; the runtime caps these calls at the same bound.
	remoteSlowControlTimeout = 3 * time.Minute
	maxRemoteLogLines        = 10000
	defaultRemoteLogLines    = 100
	// MaxRemoteBackupBytes mirrors the 64 MiB cap the master applies to any
	// node response, so a backup that can be pulled can also be pushed back.
	MaxRemoteBackupBytes = 64 << 20
)

// ErrRemoteInvalidRequest marks input the allowlisted admin proxy refuses
// before any node is contacted.
var ErrRemoteInvalidRequest = errors.New("invalid remote admin request")

var (
	remoteLogLevels   = []string{"debug", "info", "notice", "warning", "err"}
	remoteXrayVerRe   = regexp.MustCompile(`^[0-9A-Za-z][0-9A-Za-z._+-]{0,31}$`)
	remoteLogFilterRe = regexp.MustCompile(`^[^\x00-\x1f]{0,200}$`)
)

// ErrRemoteAdminScopeRequired explains a node refusing a panel-control call: its
// API token for this panel is node-sync scoped (or the link is mTLS-only).
var ErrRemoteAdminScopeRequired = errors.New("the remote FullBoard panel refused this action: give this node an admin-scope API token to manage its settings and restarts")

func (s *NodeService) remoteForControl(id int) (*runtime.Remote, error) {
	n, err := s.GetById(id)
	if err != nil || n == nil {
		return nil, fmt.Errorf("node not found")
	}
	if !n.Enable {
		return nil, fmt.Errorf("node is disabled")
	}
	mgr := runtime.GetManager()
	if mgr == nil {
		return nil, fmt.Errorf("runtime manager unavailable")
	}
	return mgr.RemoteFor(n)
}

func withRemoteControl[T any](s *NodeService, id int, call func(context.Context, *runtime.Remote) (T, error)) (T, error) {
	return withRemoteControlTimeout(s, id, remoteControlTimeout, call)
}

func withRemoteControlTimeout[T any](s *NodeService, id int, timeout time.Duration, call func(context.Context, *runtime.Remote) (T, error)) (T, error) {
	var zero T
	remote, err := s.remoteForControl(id)
	if err != nil {
		return zero, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	out, err := call(ctx, remote)
	if err != nil && strings.Contains(err.Error(), "HTTP 403") {
		return zero, ErrRemoteAdminScopeRequired
	}
	return out, err
}

func (s *NodeService) RemoteServerStatus(id int) (json.RawMessage, error) {
	return withRemoteControl(s, id, func(ctx context.Context, r *runtime.Remote) (json.RawMessage, error) {
		return r.GetServerStatus(ctx)
	})
}

func (s *NodeService) RemotePanelSettings(id int) (json.RawMessage, error) {
	return withRemoteControl(s, id, func(ctx context.Context, r *runtime.Remote) (json.RawMessage, error) {
		return r.GetPanelSettings(ctx)
	})
}

func (s *NodeService) UpdateRemotePanelSettings(id int, settings json.RawMessage) error {
	_, err := withRemoteControl(s, id, func(ctx context.Context, r *runtime.Remote) (struct{}, error) {
		return struct{}{}, r.UpdatePanelSettings(ctx, settings)
	})
	return err
}

func (s *NodeService) RestartRemoteXray(id int) error {
	_, err := withRemoteControl(s, id, func(ctx context.Context, r *runtime.Remote) (struct{}, error) {
		return struct{}{}, r.RestartXray(ctx)
	})
	return err
}

func (s *NodeService) RestartRemotePanel(id int) error {
	_, err := withRemoteControl(s, id, func(ctx context.Context, r *runtime.Remote) (struct{}, error) {
		return struct{}{}, r.RestartPanel(ctx)
	})
	return err
}

// RemoteLogsRequest selects one node log stream. Source is "panel" or "xray";
// Level and Syslog only apply to the panel stream, Filter only to Xray's.
type RemoteLogsRequest struct {
	Source string `json:"source" form:"source" example:"panel"`
	Count  int    `json:"count" form:"count" example:"100"`
	Level  string `json:"level" form:"level" example:"info"`
	Syslog bool   `json:"syslog" form:"syslog" example:"false"`
	Filter string `json:"filter" form:"filter" example:""`
}

func (r *RemoteLogsRequest) normalize() error {
	if r.Count == 0 {
		r.Count = defaultRemoteLogLines
	}
	if r.Count < 1 || r.Count > maxRemoteLogLines {
		return fmt.Errorf("%w: count must be 1-%d", ErrRemoteInvalidRequest, maxRemoteLogLines)
	}
	switch r.Source {
	case "panel":
		if r.Level == "" {
			r.Level = "info"
		}
		if !slices.Contains(remoteLogLevels, r.Level) {
			return fmt.Errorf("%w: unknown log level %q", ErrRemoteInvalidRequest, r.Level)
		}
	case "xray":
		if !remoteLogFilterRe.MatchString(r.Filter) {
			return fmt.Errorf("%w: log filter must be at most 200 printable characters", ErrRemoteInvalidRequest)
		}
	default:
		return fmt.Errorf("%w: source must be panel or xray", ErrRemoteInvalidRequest)
	}
	return nil
}

// RemoteLiveInbound is an inbound as the node itself serves it, flagged with
// whether this panel already manages it.
type RemoteLiveInbound struct {
	Id       int    `json:"id" example:"3"`
	Tag      string `json:"tag" example:"in-443-tcp"`
	Remark   string `json:"remark" example:"edge-vless"`
	Listen   string `json:"listen" example:""`
	Protocol string `json:"protocol" example:"vless"`
	Port     int    `json:"port" example:"443"`
	Adopted  bool   `json:"adopted" example:"false"`
}

// RemoteLoginURL carries the one-time URL that signs a browser into a node panel.
type RemoteLoginURL struct {
	Url string `json:"url" example:"https://node.example.com:2053/#loginTicket=abc123"`
}

// LoginTicketResponse is what a node returns to an admin token asking for a login ticket.
type LoginTicketResponse struct {
	Ticket    string `json:"ticket" example:"q3dKx0m7uZ1pYb2l9sVwQeR5tN8aHc4F6gJ_iLoPzXk"`
	ExpiresIn int    `json:"expiresIn" example:"45"`
}

func (s *NodeService) RemoteXraySetting(id int) (json.RawMessage, error) {
	return withRemoteControl(s, id, func(ctx context.Context, r *runtime.Remote) (json.RawMessage, error) {
		return r.GetXraySetting(ctx)
	})
}

func (s *NodeService) UpdateRemoteXraySetting(id int, xraySetting, outboundTestURL string) error {
	var probe map[string]json.RawMessage
	if err := json.Unmarshal([]byte(xraySetting), &probe); err != nil || probe == nil {
		return fmt.Errorf("%w: xraySetting must be a JSON object", ErrRemoteInvalidRequest)
	}
	_, err := withRemoteControl(s, id, func(ctx context.Context, r *runtime.Remote) (struct{}, error) {
		return struct{}{}, r.UpdateXraySetting(ctx, xraySetting, outboundTestURL)
	})
	if err == nil {
		logger.Infof("remote node %d: xray template saved", id)
	}
	return err
}

func (s *NodeService) RemoteLogs(id int, req RemoteLogsRequest) (json.RawMessage, error) {
	if err := req.normalize(); err != nil {
		return nil, err
	}
	return withRemoteControl(s, id, func(ctx context.Context, r *runtime.Remote) (json.RawMessage, error) {
		if req.Source == "xray" {
			return r.GetXrayLogs(ctx, req.Count, req.Filter)
		}
		lines, err := r.GetPanelLogs(ctx, req.Count, req.Level, req.Syslog)
		if err != nil {
			return nil, err
		}
		return json.Marshal(lines)
	})
}

func (s *NodeService) StopRemoteXray(id int) error {
	_, err := withRemoteControl(s, id, func(ctx context.Context, r *runtime.Remote) (struct{}, error) {
		return struct{}{}, r.StopXray(ctx)
	})
	logger.Infof("remote node %d: xray stop requested", id)
	return err
}

func (s *NodeService) InstallRemoteXray(id int, version string) error {
	if !remoteXrayVerRe.MatchString(version) {
		return fmt.Errorf("%w: malformed Xray version", ErrRemoteInvalidRequest)
	}
	_, err := withRemoteControlTimeout(s, id, remoteSlowControlTimeout, func(ctx context.Context, r *runtime.Remote) (struct{}, error) {
		return struct{}{}, r.InstallXray(ctx, version)
	})
	logger.Infof("remote node %d: xray install %s requested", id, version)
	return err
}

// UpdateRemoteGeofile refreshes one geo file, or every file when fileName is empty.
func (s *NodeService) UpdateRemoteGeofile(id int, fileName string) error {
	if fileName != "" && !(&ServerService{}).IsValidGeofileName(fileName) {
		return fmt.Errorf("%w: invalid geofile name", ErrRemoteInvalidRequest)
	}
	_, err := withRemoteControlTimeout(s, id, remoteSlowControlTimeout, func(ctx context.Context, r *runtime.Remote) (struct{}, error) {
		return struct{}{}, r.UpdateGeofile(ctx, fileName)
	})
	return err
}

func (s *NodeService) RemoteBackup(id int) ([]byte, error) {
	return withRemoteControlTimeout(s, id, remoteSlowControlTimeout, func(ctx context.Context, r *runtime.Remote) ([]byte, error) {
		return r.GetBackup(ctx)
	})
}

// ImportRemoteBackup replaces the node's data with db; the node restarts itself afterwards.
func (s *NodeService) ImportRemoteBackup(id int, db []byte, keepHostSettings bool) error {
	if len(db) == 0 || len(db) > MaxRemoteBackupBytes {
		return fmt.Errorf("%w: backup must be 1 byte to %d MiB", ErrRemoteInvalidRequest, MaxRemoteBackupBytes>>20)
	}
	_, err := withRemoteControlTimeout(s, id, remoteSlowControlTimeout, func(ctx context.Context, r *runtime.Remote) (struct{}, error) {
		return struct{}{}, r.ImportBackup(ctx, db, keepHostSettings)
	})
	logger.Warningf("remote node %d: database import requested (keepHostSettings=%v)", id, keepHostSettings)
	return err
}

// RemoteLiveInbounds lists what the node serves right now, marking the inbounds
// this panel already manages.
func (s *NodeService) RemoteLiveInbounds(id int) ([]RemoteLiveInbound, error) {
	options, err := withRemoteControl(s, id, func(ctx context.Context, r *runtime.Remote) ([]runtime.RemoteInboundOption, error) {
		return r.ListInboundOptions(ctx)
	})
	if err != nil {
		return nil, err
	}
	var managedTags []string
	if err := database.GetDB().Model(model.Inbound{}).Where("node_id = ?", id).Pluck("tag", &managedTags).Error; err != nil {
		return nil, err
	}
	return markLiveInbounds(id, options, managedTags), nil
}

func markLiveInbounds(nodeID int, options []runtime.RemoteInboundOption, managedTags []string) []RemoteLiveInbound {
	managed := make(map[string]struct{}, len(managedTags))
	for _, tag := range managedTags {
		managed[tag] = struct{}{}
	}
	prefix := nodeTagPrefix(&nodeID)
	out := make([]RemoteLiveInbound, 0, len(options))
	for _, o := range options {
		_, bare := managed[o.Tag]
		_, prefixed := managed[prefix+o.Tag]
		out = append(out, RemoteLiveInbound{
			Id: o.Id, Tag: o.Tag, Remark: o.Remark, Listen: o.Listen,
			Protocol: string(o.Protocol), Port: o.Port, Adopted: bare || prefixed,
		})
	}
	return out
}

// AdoptRemoteInbound makes this panel manage a node's inbound: it joins the
// node's selection (when the node syncs "selected" inbounds) and the next sync
// imports it. A node syncing "all" already imports every inbound on its own.
func (s *NodeService) AdoptRemoteInbound(id int, tag string) error {
	tag = strings.TrimSpace(tag)
	if tag == "" {
		return fmt.Errorf("%w: inbound tag is required", ErrRemoteInvalidRequest)
	}
	live, err := s.RemoteLiveInbounds(id)
	if err != nil {
		return err
	}
	if !slices.ContainsFunc(live, func(ib RemoteLiveInbound) bool { return ib.Tag == tag }) {
		return fmt.Errorf("%w: the node does not serve an inbound tagged %q", ErrRemoteInvalidRequest, tag)
	}
	if err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		return s.selectNodeInboundTx(tx, id, tag)
	}); err != nil {
		return err
	}
	if mgr := runtime.GetManager(); mgr != nil {
		mgr.InvalidateNode(id)
	}
	logger.Infof("remote node %d: inbound %q adopted", id, tag)
	return nil
}

// selectNodeInboundTx zeroes InboundsAdoptedAt when the selection grows so the
// orphan sweep waits for the clean sync that imports the new inbound.
func (s *NodeService) selectNodeInboundTx(tx *gorm.DB, nodeID int, tag string) error {
	node := &model.Node{}
	if err := tx.Where("id = ?", nodeID).First(node).Error; err != nil {
		return err
	}
	if node.InboundSyncMode == "selected" && !slices.Contains(node.InboundTags, tag) {
		buf, err := json.Marshal(append(slices.Clone(node.InboundTags), tag))
		if err != nil {
			return err
		}
		if err := tx.Model(model.Node{}).Where("id = ?", nodeID).Updates(map[string]any{
			"inbound_tags":        string(buf),
			"inbounds_adopted_at": 0,
		}).Error; err != nil {
			return err
		}
	}
	return s.MarkNodeDirtyTx(tx, nodeID)
}

// RemoteLoginURL asks the node for a login ticket and returns the browser URL
// that redeems it. The node refuses anything but an admin-scope token.
func (s *NodeService) RemoteLoginURL(id int) (string, error) {
	url, err := withRemoteControl(s, id, func(ctx context.Context, r *runtime.Remote) (string, error) {
		ticket, err := r.IssueLoginTicket(ctx)
		if err != nil {
			return "", err
		}
		return r.LoginURL(ticket)
	})
	if err == nil {
		logger.Infof("remote node %d: login ticket issued", id)
	}
	return url, err
}
