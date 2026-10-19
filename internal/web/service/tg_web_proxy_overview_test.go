package service

import (
	"errors"
	"reflect"
	"testing"

	"github.com/WeIbSchatten/We1ssBoard/v3/internal/tgwebproxy"
)

func relayStatus(active string, admin *tgwebproxy.RelayAdminProbe, backends ...bool) *tgwebproxy.RelayStatus {
	st := &tgwebproxy.RelayStatus{
		BinaryInstalled: true,
		ConfigExists:    true,
		ProfileCount:    3,
		Hostname:        "proxy.example.com",
		Admin:           admin,
		Units:           []tgwebproxy.RelayUnitStatus{{Unit: "caddy", ActiveState: "active"}, {Unit: tgwebproxy.RelayUnit, ActiveState: active}},
	}
	for _, on := range backends {
		st.Backends.Managed = append(st.Backends.Managed, tgwebproxy.RelayManagedBackend{Active: on})
	}
	return st
}

func TestBuildTgWebProxyOverview(t *testing.T) {
	healthy := &tgwebproxy.RelayAdminProbe{Reachable: true, Healthy: true, Ready: true}
	notReady := &tgwebproxy.RelayAdminProbe{Reachable: true, Healthy: true, ReadyDetail: "backend 127.0.0.1:31000 unreachable"}

	got := buildTgWebProxyOverview(
		relayStatus("active", healthy, true, false),
		[]nodeRelayStatus{
			{id: 1, name: "eu", status: relayStatus("active", notReady, true)},
			{id: 2, name: "no-relay", status: &tgwebproxy.RelayStatus{}},
			{id: 3, name: "down", err: errors.New("dial tcp: i/o timeout")},
			{id: 4, name: "down-unused", err: errors.New("node is disabled")},
			{id: 5, name: "stopped", status: relayStatus("failed", nil)},
		},
		map[int]int{0: 4, 1: 7, 3: 2},
	)

	want := []TgWebProxyRelaySummary{
		{NodeID: 0, Hostname: "proxy.example.com", Installed: true, Running: true, Ready: true, Profiles: 3, Clients: 4, BackendsActive: 1, BackendsTotal: 2},
		{NodeID: 1, Name: "eu", Hostname: "proxy.example.com", Installed: true, Running: true, Profiles: 3, Clients: 7, BackendsActive: 1, BackendsTotal: 1, Error: "backend 127.0.0.1:31000 unreachable"},
		{NodeID: 3, Name: "down", Clients: 2, Error: "dial tcp: i/o timeout"},
		{NodeID: 5, Name: "stopped", Hostname: "proxy.example.com", Installed: true, Profiles: 3},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("overview =\n%+v\nwant\n%+v", got, want)
	}
}

func TestBuildTgWebProxyOverviewSkipsHostWithoutRelay(t *testing.T) {
	if got := buildTgWebProxyOverview(&tgwebproxy.RelayStatus{}, nil, nil); len(got) != 0 {
		t.Fatalf("overview = %+v, want nothing for a panel without a relay or bindings", got)
	}
}
