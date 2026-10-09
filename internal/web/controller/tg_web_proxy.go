package controller

import (
	"strconv"

	"github.com/WeIbSchatten/FullBoard/v3/internal/tgwebproxy"
	"github.com/WeIbSchatten/FullBoard/v3/internal/web/middleware"
	"github.com/WeIbSchatten/FullBoard/v3/internal/web/service"

	"github.com/gin-gonic/gin"
)

type tgWebProxyPublicSitePutRequest struct {
	IndexHTML string `json:"indexHtml" example:"<!DOCTYPE html><html><body>Welcome</body></html>"`
}

// TgWebProxyController exposes tproxy-server management under
// /panel/api/tgWebProxy. The relay admin listener is only ever probed server-side.
type TgWebProxyController struct {
	svc service.TgWebProxyService
}

func NewTgWebProxyController(g *gin.RouterGroup) *TgWebProxyController {
	a := &TgWebProxyController{}
	a.initRouter(g)
	return a
}

func (a *TgWebProxyController) initRouter(g *gin.RouterGroup) {
	g.GET("/status", a.status)
	g.GET("/config", a.getConfig)
	g.POST("/config", a.saveConfig)
	g.POST("/check", a.check)
	g.GET("/profiles", a.listProfiles)
	g.POST("/profiles/add", a.addProfile)
	g.POST("/profiles/update/:name", a.updateProfile)
	g.POST("/profiles/del/:name", a.delProfile)
	g.GET("/share/:name", a.share)
	g.POST("/service/:unit/:action", a.controlUnit)
	g.GET("/logs/:unit", a.logs)
	g.POST("/install", a.install)
	g.POST("/update", a.update)
	g.GET("/job", a.job)
	g.GET("/publicSite", a.getPublicSite)
	g.POST("/publicSite", a.putPublicSite)
	g.POST("/publicSite/reset", a.resetPublicSite)
	g.POST("/publicSite/upload", a.uploadPublicSite)
	g.POST("/publicSite/del/:name", a.deletePublicSiteAsset)
	g.GET("/bindings", a.listBindings)
	g.POST("/bindings/bind", a.bindClient)
	g.POST("/bindings/unbind", a.unbindClient)
}

func (a *TgWebProxyController) listBindings(c *gin.Context) {
	list, err := a.svc.ListBindings()
	if err != nil {
		jsonMsg(c, I18nWeb(c, "pages.tgWebProxy.toasts.load"), err)
		return
	}
	jsonObj(c, list, nil)
}

func (a *TgWebProxyController) bindClient(c *gin.Context) {
	req, ok := middleware.BindJSONAndValidate[service.TgWebProxyBindRequest](c)
	if !ok {
		return
	}
	binding, err := a.svc.BindClient(*req)
	jsonMsgObj(c, I18nWeb(c, "pages.tgWebProxy.toasts.saved"), binding, err)
}

func (a *TgWebProxyController) unbindClient(c *gin.Context) {
	req, ok := middleware.BindJSONAndValidate[service.TgWebProxyUnbindRequest](c)
	if !ok {
		return
	}
	err := a.svc.UnbindClient(req.Email)
	jsonMsg(c, I18nWeb(c, "pages.tgWebProxy.toasts.deleted"), err)
}

func (a *TgWebProxyController) status(c *gin.Context) {
	jsonObj(c, a.svc.Status(c.Request.Context()), nil)
}

func (a *TgWebProxyController) getConfig(c *gin.Context) {
	snap, err := a.svc.Snapshot()
	if err != nil {
		jsonMsg(c, I18nWeb(c, "pages.tgWebProxy.toasts.load"), err)
		return
	}
	jsonObj(c, snap, nil)
}

func (a *TgWebProxyController) saveConfig(c *gin.Context) {
	req, ok := middleware.BindJSONAndValidate[service.TgWebProxyConfigRequest](c)
	if !ok {
		return
	}
	res, err := a.svc.SaveConfig(c.Request.Context(), *req)
	jsonMsgObj(c, I18nWeb(c, "pages.tgWebProxy.toasts.saved"), res, err)
}

func (a *TgWebProxyController) check(c *gin.Context) {
	err := a.svc.Check(c.Request.Context())
	jsonMsg(c, I18nWeb(c, "pages.tgWebProxy.toasts.checkOk"), err)
}

func (a *TgWebProxyController) listProfiles(c *gin.Context) {
	snap, err := a.svc.Snapshot()
	if err != nil {
		jsonMsg(c, I18nWeb(c, "pages.tgWebProxy.toasts.load"), err)
		return
	}
	jsonObj(c, snap.Profiles, nil)
}

func (a *TgWebProxyController) addProfile(c *gin.Context) {
	p, ok := middleware.BindJSONAndValidate[tgwebproxy.RelayProfile](c)
	if !ok {
		return
	}
	res, err := a.svc.AddProfile(c.Request.Context(), *p)
	jsonMsgObj(c, I18nWeb(c, "pages.tgWebProxy.toasts.saved"), res, err)
}

func (a *TgWebProxyController) updateProfile(c *gin.Context) {
	p, ok := middleware.BindJSONAndValidate[tgwebproxy.RelayProfile](c)
	if !ok {
		return
	}
	res, err := a.svc.UpdateProfile(c.Request.Context(), c.Param("name"), *p)
	jsonMsgObj(c, I18nWeb(c, "pages.tgWebProxy.toasts.saved"), res, err)
}

func (a *TgWebProxyController) delProfile(c *gin.Context) {
	res, err := a.svc.DeleteProfile(c.Request.Context(), c.Param("name"))
	jsonMsgObj(c, I18nWeb(c, "pages.tgWebProxy.toasts.deleted"), res, err)
}

func (a *TgWebProxyController) share(c *gin.Context) {
	info, err := a.svc.Share(c.Param("name"))
	if err != nil {
		jsonMsg(c, I18nWeb(c, "pages.tgWebProxy.toasts.load"), err)
		return
	}
	jsonObj(c, info, nil)
}

func (a *TgWebProxyController) controlUnit(c *gin.Context) {
	err := a.svc.ControlUnit(c.Request.Context(), c.Param("unit"), c.Param("action"))
	jsonMsg(c, I18nWeb(c, "pages.tgWebProxy.toasts.serviceDone"), err)
}

func (a *TgWebProxyController) logs(c *gin.Context) {
	lines, _ := strconv.Atoi(c.DefaultQuery("lines", "200"))
	out, err := a.svc.Logs(c.Request.Context(), c.Param("unit"), lines)
	if err != nil {
		jsonMsg(c, I18nWeb(c, "pages.tgWebProxy.toasts.load"), err)
		return
	}
	jsonObj(c, out, nil)
}

func (a *TgWebProxyController) install(c *gin.Context) {
	req, ok := middleware.BindJSONAndValidate[tgwebproxy.RelayInstallRequest](c)
	if !ok {
		return
	}
	job, err := a.svc.Install(c.Request.Context(), *req)
	jsonMsgObj(c, I18nWeb(c, "pages.tgWebProxy.toasts.jobStarted"), job, err)
}

func (a *TgWebProxyController) update(c *gin.Context) {
	job, err := a.svc.Update(c.Request.Context())
	jsonMsgObj(c, I18nWeb(c, "pages.tgWebProxy.toasts.jobStarted"), job, err)
}

func (a *TgWebProxyController) job(c *gin.Context) {
	jsonObj(c, a.svc.Job(c.Request.Context()), nil)
}

func (a *TgWebProxyController) getPublicSite(c *gin.Context) {
	snap, err := a.svc.GetPublicSite()
	if err != nil {
		jsonMsg(c, I18nWeb(c, "pages.tgWebProxy.toasts.load"), err)
		return
	}
	jsonObj(c, snap, nil)
}

func (a *TgWebProxyController) putPublicSite(c *gin.Context) {
	req, ok := middleware.BindJSONAndValidate[tgWebProxyPublicSitePutRequest](c)
	if !ok {
		return
	}
	res, err := a.svc.PutPublicSiteIndex(c.Request.Context(), req.IndexHTML)
	jsonMsgObj(c, I18nWeb(c, "pages.tgWebProxy.toasts.saved"), res, err)
}

func (a *TgWebProxyController) resetPublicSite(c *gin.Context) {
	res, err := a.svc.ResetPublicSite(c.Request.Context())
	jsonMsgObj(c, I18nWeb(c, "pages.tgWebProxy.toasts.saved"), res, err)
}

func (a *TgWebProxyController) uploadPublicSite(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		jsonMsg(c, I18nWeb(c, "pages.tgWebProxy.toasts.load"), err)
		return
	}
	f, err := file.Open()
	if err != nil {
		jsonMsg(c, I18nWeb(c, "pages.tgWebProxy.toasts.load"), err)
		return
	}
	defer f.Close()
	name := c.PostForm("name")
	if name == "" {
		name = file.Filename
	}
	err = a.svc.UploadPublicSiteAsset(name, f, file.Size)
	jsonMsg(c, I18nWeb(c, "pages.tgWebProxy.toasts.saved"), err)
}

func (a *TgWebProxyController) deletePublicSiteAsset(c *gin.Context) {
	err := a.svc.DeletePublicSiteAsset(c.Param("name"))
	jsonMsg(c, I18nWeb(c, "pages.tgWebProxy.toasts.deleted"), err)
}
