package controller

import (
	"crypto/sha256"
	"encoding/hex"
	htmlpkg "html"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/WeIbSchatten/FullBoard/v3/internal/database"
	"github.com/WeIbSchatten/FullBoard/v3/internal/logger"
	"github.com/WeIbSchatten/FullBoard/v3/internal/web/service"
)

const (
	customPanelCssPath = "panel/custom.css"
	customLoginCssPath = "custom-login.css"
)

// customCssForPage returns the operator stylesheet for a served page and the
// base-relative URL it is served from; pages without a stylesheet get "".
func customCssForPage(page string) (css, relPath string) {
	if database.GetDB() == nil {
		return "", ""
	}
	s := service.SettingService{}
	var err error
	switch page {
	case "index.html":
		css, err = s.GetCustomCss()
		relPath = customPanelCssPath
	case "login.html":
		css, err = s.GetCustomLoginCss()
		relPath = customLoginCssPath
	default:
		return "", ""
	}
	if err != nil {
		logger.Warning("custom css lookup failed:", err)
		return "", ""
	}
	return css, relPath
}

func cssVersion(css string) string {
	sum := sha256.Sum256([]byte(css))
	return hex.EncodeToString(sum[:6])
}

// customCssHeadInjection links the stylesheet instead of inlining it, so no
// operator input is ever parsed as HTML (a "</style><script>" stays inert CSS).
func customCssHeadInjection(basePath, page string) []byte {
	css, relPath := customCssForPage(page)
	if css == "" {
		return nil
	}
	href := normalizeWebBasePath(basePath) + relPath + "?v=" + cssVersion(css)
	return []byte(`<link rel="stylesheet" id="fullboard-custom-css" href="` + htmlpkg.EscapeString(href) + `">`)
}

func serveCustomCss(c *gin.Context, page string) {
	css, _ := customCssForPage(page)
	c.Header("Cache-Control", "no-cache")
	c.Header("X-Content-Type-Options", "nosniff")
	c.Data(http.StatusOK, "text/css; charset=utf-8", []byte(css))
}
