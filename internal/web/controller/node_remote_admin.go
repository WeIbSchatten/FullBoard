package controller

import (
	"fmt"
	"io"
	"net/http"

	"github.com/WeIbSchatten/FullBoard/v3/internal/web/service"

	"github.com/gin-gonic/gin"
)

// initRemoteAdminRouter registers the allowlisted proxy to a node panel's admin
// surface. None of these paths appear in a node-sync or monitor token's scope,
// so the API middleware already refuses them for anything but an admin.
func (a *NodeController) initRemoteAdminRouter(g *gin.RouterGroup) {
	g.GET("/remote/:id/xray", a.remoteXray)
	g.POST("/remote/:id/xray", a.updateRemoteXray)
	g.POST("/remote/:id/logs", a.remoteLogs)
	g.POST("/remote/:id/stopXray", a.stopRemoteXray)
	g.POST("/remote/:id/installXray", a.installRemoteXray)
	g.POST("/remote/:id/geofile", a.updateRemoteGeofile)
	g.GET("/remote/:id/backup", a.remoteBackup)
	g.POST("/remote/:id/backup/import", a.importRemoteBackup)
	g.GET("/remote/:id/inbounds", a.remoteInbounds)
	g.POST("/remote/:id/adopt", a.adoptRemoteInbound)
	g.POST("/remote/:id/loginAs", a.remoteLoginAs)
}

type remoteXrayForm struct {
	XraySetting     string `json:"xraySetting" form:"xraySetting"`
	OutboundTestUrl string `json:"outboundTestUrl" form:"outboundTestUrl"`
}

type remoteInstallXrayForm struct {
	Version string `json:"version" form:"version"`
}

type remoteGeofileForm struct {
	FileName string `json:"fileName" form:"fileName"`
}

type remoteAdoptForm struct {
	Tag string `json:"tag" form:"tag"`
}

func (a *NodeController) remoteXray(c *gin.Context) {
	id, ok := remoteNodeID(c)
	if !ok {
		return
	}
	setting, err := a.nodeService.RemoteXraySetting(id)
	jsonObj(c, setting, err)
}

func (a *NodeController) updateRemoteXray(c *gin.Context) {
	id, ok := remoteNodeID(c)
	if !ok {
		return
	}
	var form remoteXrayForm
	if err := c.ShouldBind(&form); err != nil {
		jsonMsg(c, I18nWeb(c, "pages.nodes.toasts.remoteXraySaved"), err)
		return
	}
	jsonMsg(c, I18nWeb(c, "pages.nodes.toasts.remoteXraySaved"),
		a.nodeService.UpdateRemoteXraySetting(id, form.XraySetting, form.OutboundTestUrl))
}

func (a *NodeController) remoteLogs(c *gin.Context) {
	id, ok := remoteNodeID(c)
	if !ok {
		return
	}
	var req service.RemoteLogsRequest
	if err := c.ShouldBind(&req); err != nil {
		jsonMsg(c, I18nWeb(c, "get"), err)
		return
	}
	logs, err := a.nodeService.RemoteLogs(id, req)
	jsonObj(c, logs, err)
}

func (a *NodeController) stopRemoteXray(c *gin.Context) {
	id, ok := remoteNodeID(c)
	if !ok {
		return
	}
	jsonMsg(c, I18nWeb(c, "pages.xray.stopSuccess"), a.nodeService.StopRemoteXray(id))
}

func (a *NodeController) installRemoteXray(c *gin.Context) {
	id, ok := remoteNodeID(c)
	if !ok {
		return
	}
	var form remoteInstallXrayForm
	if err := c.ShouldBind(&form); err != nil {
		jsonMsg(c, I18nWeb(c, "pages.index.xraySwitchVersionPopover"), err)
		return
	}
	jsonMsg(c, I18nWeb(c, "pages.index.xraySwitchVersionPopover"), a.nodeService.InstallRemoteXray(id, form.Version))
}

func (a *NodeController) updateRemoteGeofile(c *gin.Context) {
	id, ok := remoteNodeID(c)
	if !ok {
		return
	}
	var form remoteGeofileForm
	if err := c.ShouldBind(&form); err != nil {
		jsonMsg(c, I18nWeb(c, "pages.index.geofileUpdatePopover"), err)
		return
	}
	jsonMsg(c, I18nWeb(c, "pages.index.geofileUpdatePopover"), a.nodeService.UpdateRemoteGeofile(id, form.FileName))
}

func (a *NodeController) remoteBackup(c *gin.Context) {
	id, ok := remoteNodeID(c)
	if !ok {
		return
	}
	data, err := a.nodeService.RemoteBackup(id)
	if err != nil {
		jsonMsg(c, I18nWeb(c, "pages.index.getDatabaseError"), err)
		return
	}
	c.Header("Content-Type", "application/octet-stream")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=fullboard-node-%d.db", id))
	_, _ = c.Writer.Write(data)
}

func (a *NodeController) importRemoteBackup(c *gin.Context) {
	id, ok := remoteNodeID(c)
	if !ok {
		return
	}
	// The global 10 MiB body cap skips this route; bound the upload here instead.
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, service.MaxRemoteBackupBytes+(1<<20))
	file, _, err := c.Request.FormFile("db")
	if err != nil {
		jsonMsg(c, I18nWeb(c, "pages.index.readDatabaseError"), err)
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, service.MaxRemoteBackupBytes+1))
	if err != nil {
		jsonMsg(c, I18nWeb(c, "pages.index.readDatabaseError"), err)
		return
	}
	// Same default as the node's own importDB: keep the node's host settings
	// unless the admin explicitly asks to clone the source machine wholesale.
	keepHostSettings := c.Request.FormValue("keepHostSettings") != "false"
	jsonMsg(c, I18nWeb(c, "pages.index.importDatabaseSuccess"),
		a.nodeService.ImportRemoteBackup(id, data, keepHostSettings))
}

func (a *NodeController) remoteInbounds(c *gin.Context) {
	id, ok := remoteNodeID(c)
	if !ok {
		return
	}
	live, err := a.nodeService.RemoteLiveInbounds(id)
	jsonObj(c, live, err)
}

func (a *NodeController) adoptRemoteInbound(c *gin.Context) {
	id, ok := remoteNodeID(c)
	if !ok {
		return
	}
	var form remoteAdoptForm
	if err := c.ShouldBind(&form); err != nil {
		jsonMsg(c, I18nWeb(c, "pages.nodes.toasts.remoteInboundAdopted"), err)
		return
	}
	jsonMsg(c, I18nWeb(c, "pages.nodes.toasts.remoteInboundAdopted"), a.nodeService.AdoptRemoteInbound(id, form.Tag))
}

func (a *NodeController) remoteLoginAs(c *gin.Context) {
	id, ok := remoteNodeID(c)
	if !ok {
		return
	}
	loginURL, err := a.nodeService.RemoteLoginURL(id)
	if err != nil {
		jsonMsg(c, I18nWeb(c, "get"), err)
		return
	}
	c.Header("Cache-Control", "no-store")
	jsonObj(c, service.RemoteLoginURL{Url: loginURL}, nil)
}
