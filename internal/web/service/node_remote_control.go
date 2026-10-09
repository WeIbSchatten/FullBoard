package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/WeIbSchatten/FullBoard/v3/internal/web/runtime"
)

const remoteControlTimeout = 15 * time.Second

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
	var zero T
	remote, err := s.remoteForControl(id)
	if err != nil {
		return zero, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), remoteControlTimeout)
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
