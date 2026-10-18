package tgbot

import (
	"context"
	"fmt"
	"html"
	"strconv"
	"strings"
	"time"

	"github.com/WeIbSchatten/We1ssBoard/v3/internal/database/model"
	"github.com/WeIbSchatten/We1ssBoard/v3/internal/logger"
	"github.com/WeIbSchatten/We1ssBoard/v3/internal/tgwebproxy"
	"github.com/WeIbSchatten/We1ssBoard/v3/internal/web/service"
)

func (t *Tgbot) nodesReport() string {
	nodes, err := (&service.NodeService{}).GetAll()
	if err != nil {
		logger.Warning("tgbot: list nodes:", err)
		return t.I18nBot("tgbot.wentWrong")
	}
	return t.formatNodesReport(nodes)
}

func (t *Tgbot) formatNodesReport(nodes []*model.Node) string {
	if len(nodes) == 0 {
		return t.I18nBot("tgbot.messages.noNodes")
	}
	enabled, online := 0, 0
	var lines []string
	for _, n := range nodes {
		name := "<b>" + html.EscapeString(n.Name) + "</b>"
		switch {
		case !n.Enable:
			lines = append(lines, "⚪ "+name+" — "+t.I18nBot("tgbot.messages.nodeDisabled"))
			continue
		case n.Status == "online":
			online++
			parts := []string{
				strconv.Itoa(n.LatencyMs) + " ms",
				fmt.Sprintf("CPU %.0f%%", n.CpuPct),
				fmt.Sprintf("RAM %.0f%%", n.MemPct),
			}
			if n.XrayVersion != "" {
				parts = append(parts, "Xray "+html.EscapeString(n.XrayVersion))
			}
			lines = append(lines, "🟢 "+name+" — "+strings.Join(parts, " · "))
		default:
			line := "🔴 " + name + " — " + t.I18nBot("tgbot.messages.nodeOffline")
			if n.LastHeartbeat > 0 {
				seen := time.Unix(n.LastHeartbeat, 0).Format("2006-01-02 15:04")
				line += " · " + t.I18nBot("tgbot.messages.nodeLastSeen", "Time=="+seen)
			}
			if n.LastError != "" {
				line += "\n    <code>" + html.EscapeString(n.LastError) + "</code>"
			}
			lines = append(lines, line)
		}
		enabled++
	}
	header := t.I18nBot("tgbot.messages.nodesTitle", "Online=="+strconv.Itoa(online), "Total=="+strconv.Itoa(enabled))
	return header + "\n\n" + strings.Join(lines, "\n")
}

func (t *Tgbot) webProxyReport() string {
	svc := &service.TgWebProxyService{}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	status := svc.Status(ctx)
	var profiles []tgwebproxy.RelayProfile
	if status.ConfigExists {
		snap, err := svc.Snapshot()
		if err != nil {
			logger.Warning("tgbot: tg-web-proxy snapshot:", err)
		}
		profiles = snap.Profiles
	}
	counts, err := svc.LocalBindingCounts()
	if err != nil {
		logger.Warning("tgbot: tg-web-proxy binding counts:", err)
	}
	return t.formatWebProxyReport(status, profiles, counts, svc.SyncError())
}

func (t *Tgbot) formatWebProxyReport(status tgwebproxy.RelayStatus, profiles []tgwebproxy.RelayProfile, bound map[string]int, syncErr string) string {
	title := t.I18nBot("tgbot.messages.webProxyTitle")
	switch {
	case !status.Supported:
		return title + "\n\n" + t.I18nBot("tgbot.messages.webProxyUnsupported")
	case !status.BinaryInstalled || !status.ConfigExists:
		return title + "\n\n" + t.I18nBot("tgbot.messages.webProxyNotInstalled")
	}
	msg := title + "\n\n" + t.I18nBot("tgbot.messages.webProxyHost", "Host=="+html.EscapeString(status.Hostname))
	for _, p := range profiles {
		if tgwebproxy.IsManagedProfileName(p.Name) {
			continue
		}
		mode := p.CarrierMode
		if mode == "" {
			mode = "https"
		}
		msg += "\n" + t.I18nBot("tgbot.messages.webProxyProfile",
			"Name=="+html.EscapeString(p.Name), "Mode=="+mode, "Clients=="+strconv.Itoa(bound[p.Name]))
	}
	if syncErr != "" {
		msg += "\n\n" + t.I18nBot("tgbot.messages.webProxySyncError", "Error=="+html.EscapeString(syncErr))
	}
	return msg
}
