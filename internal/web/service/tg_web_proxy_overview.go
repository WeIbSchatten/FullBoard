package service

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/WeIbSchatten/We1ssBoard/v3/internal/database"
	"github.com/WeIbSchatten/We1ssBoard/v3/internal/database/model"
	"github.com/WeIbSchatten/We1ssBoard/v3/internal/tgwebproxy"
	"github.com/WeIbSchatten/We1ssBoard/v3/internal/web/runtime"
)

// TgWebProxyRelaySummary is one relay host for the dashboard: this panel's own
// (NodeID 0) or a node's, reached through remote control.
type TgWebProxyRelaySummary struct {
	NodeID         int    `json:"nodeId" example:"1"`
	Name           string `json:"name" example:"eu-1"`
	Hostname       string `json:"hostname" example:"proxy.example.com"`
	Installed      bool   `json:"installed" example:"true"`
	Running        bool   `json:"running" example:"true"`
	Ready          bool   `json:"ready" example:"true"`
	Profiles       int    `json:"profiles" example:"5"`
	Clients        int    `json:"clients" example:"12"`
	BackendsActive int    `json:"backendsActive" example:"1"`
	BackendsTotal  int    `json:"backendsTotal" example:"1"`
	Error          string `json:"error,omitempty" example:""`
}

type nodeRelayStatus struct {
	id     int
	name   string
	status *tgwebproxy.RelayStatus
	err    error
}

const tgWebProxyOverviewTimeout = 6 * time.Second

func summarizeRelay(st *tgwebproxy.RelayStatus) TgWebProxyRelaySummary {
	s := TgWebProxyRelaySummary{
		Hostname:  st.Hostname,
		Installed: st.BinaryInstalled || st.ConfigExists,
		Profiles:  st.ProfileCount,
		Error:     st.ConfigError,
	}
	for _, u := range st.Units {
		if u.Unit == tgwebproxy.RelayUnit {
			s.Running = u.ActiveState == "active"
		}
	}
	for _, b := range st.Backends.Managed {
		s.BackendsTotal++
		if b.Active {
			s.BackendsActive++
		}
	}
	if st.Admin != nil {
		s.Ready = st.Admin.Healthy && st.Admin.Ready
		if !s.Ready && s.Error == "" {
			s.Error = st.Admin.ReadyDetail
			if s.Error == "" {
				s.Error = st.Admin.Error
			}
		}
	}
	if s.Error == "" {
		s.Error = st.Backends.Error
	}
	return s
}

// buildTgWebProxyOverview lists hosts that run a relay, plus unreachable ones
// that still have client bindings, so an outage there is not silently hidden.
func buildTgWebProxyOverview(local *tgwebproxy.RelayStatus, nodes []nodeRelayStatus, clients map[int]int) []TgWebProxyRelaySummary {
	out := []TgWebProxyRelaySummary{}
	if s := summarizeRelay(local); s.Installed || clients[0] > 0 {
		s.Clients = clients[0]
		out = append(out, s)
	}
	for _, n := range nodes {
		var s TgWebProxyRelaySummary
		switch {
		case n.err != nil:
			if clients[n.id] == 0 {
				continue
			}
			s.Error = n.err.Error()
		default:
			s = summarizeRelay(n.status)
			if !s.Installed && clients[n.id] == 0 {
				continue
			}
		}
		s.NodeID, s.Name, s.Clients = n.id, n.name, clients[n.id]
		out = append(out, s)
	}
	return out
}

// Overview reports every relay host this panel uses or manages.
func (s *TgWebProxyService) Overview() ([]TgWebProxyRelaySummary, error) {
	ctx, cancel := context.WithTimeout(context.Background(), tgWebProxyOverviewTimeout)
	defer cancel()
	local := tgWebProxy().Status(ctx)

	clients := map[int]int{}
	var rows []model.ClientTgWebProxy
	if err := database.GetDB().Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, r := range rows {
		node := 0
		if r.NodeId != nil {
			node = *r.NodeId
		}
		clients[node]++
	}

	nodeSvc := &NodeService{}
	all, err := nodeSvc.GetAll()
	if err != nil {
		return nil, err
	}
	nodes := make([]nodeRelayStatus, len(all))
	var wg sync.WaitGroup
	for i, n := range all {
		nodes[i] = nodeRelayStatus{id: n.Id, name: n.Name}
		wg.Add(1)
		go func(slot *nodeRelayStatus) {
			defer wg.Done()
			raw, err := withRemoteControlTimeout(nodeSvc, slot.id, tgWebProxyOverviewTimeout, func(ctx context.Context, r *runtime.Remote) (json.RawMessage, error) {
				return r.GetTgWebProxyStatus(ctx)
			})
			if err != nil {
				slot.err = err
				return
			}
			var st tgwebproxy.RelayStatus
			if err := json.Unmarshal(raw, &st); err != nil {
				slot.err = err
				return
			}
			slot.status = &st
		}(&nodes[i])
	}
	wg.Wait()
	return buildTgWebProxyOverview(&local, nodes, clients), nil
}
