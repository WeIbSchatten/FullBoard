package controller

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"

	"github.com/WeIbSchatten/FullBoard/v3/internal/database"
	"github.com/WeIbSchatten/FullBoard/v3/internal/database/dbtest"
	"github.com/WeIbSchatten/FullBoard/v3/internal/database/model"
	"github.com/WeIbSchatten/FullBoard/v3/internal/web/locale"
	"github.com/WeIbSchatten/FullBoard/v3/internal/web/session"
)

const hostileCss = `body{color:red}</style><script>alert(1)</script>`

func newCustomCssTestEngine(t *testing.T, settings map[string]string) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	dbtest.InitDB(t, filepath.Join(t.TempDir(), "x-ui.db"))
	for key, value := range settings {
		if err := database.GetDB().Create(&model.Setting{Key: key, Value: value}).Error; err != nil {
			t.Fatalf("seed %s: %v", key, err)
		}
	}
	oldDistFS := distFS
	shell := []byte(`<!doctype html><html><head></head><body>shell</body></html>`)
	SetDistFS(fstest.MapFS{
		"dist/index.html": {Data: shell},
		"dist/login.html": {Data: shell},
	})
	t.Cleanup(func() { SetDistFS(oldDistFS) })

	engine := gin.New()
	engine.Use(sessions.Sessions("3x-ui", cookie.NewStore([]byte("custom-css-test-secret"))))
	engine.Use(func(c *gin.Context) {
		c.Set("base_path", "/admin/")
		c.Set("I18n", func(_ locale.I18nType, key string, _ ...string) string { return key })
		if c.GetHeader("X-Test-Login") == "1" {
			session.SetAPIAuthUser(c, &model.User{Id: 1, Username: "test"})
		}
		c.Next()
	})
	g := engine.Group("/admin/")
	NewIndexController(g)
	NewXUIController(g)
	return engine
}

func get(engine *gin.Engine, target string, login bool) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, target, nil)
	req.Header.Set("Accept", "text/html")
	if login {
		req.Header.Set("X-Test-Login", "1")
	}
	w := httptest.NewRecorder()
	engine.ServeHTTP(w, req)
	return w
}

func TestCustomCssIsLinkedNeverInlined(t *testing.T) {
	engine := newCustomCssTestEngine(t, map[string]string{
		"customCss":      hostileCss,
		"customLoginCss": hostileCss,
	})
	for _, tc := range []struct {
		name, page, href string
		login            bool
	}{
		{"login page", "/admin/", `href="/admin/custom-login.css?v=`, false},
		{"panel page", "/admin/panel/", `href="/admin/panel/custom.css?v=`, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			body := get(engine, tc.page, tc.login).Body.String()
			if !strings.Contains(body, tc.href) {
				t.Fatalf("page does not link the stylesheet %s: %s", tc.href, body)
			}
			if strings.Contains(body, "<script>alert(1)") {
				t.Fatalf("custom CSS leaked into the HTML: %s", body)
			}
		})
	}
}

func TestCustomCssServedAsInertStylesheet(t *testing.T) {
	engine := newCustomCssTestEngine(t, map[string]string{
		"customCss":      "panel{}",
		"customLoginCss": hostileCss,
	})

	login := get(engine, "/admin/custom-login.css", false)
	if login.Code != http.StatusOK || login.Body.String() != hostileCss {
		t.Fatalf("login css = %d %q, want 200 %q", login.Code, login.Body.String(), hostileCss)
	}
	if ct := login.Header().Get("Content-Type"); ct != "text/css; charset=utf-8" {
		t.Fatalf("Content-Type = %q, want text/css", ct)
	}
	if login.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatal("stylesheet must be served with nosniff")
	}

	if anon := get(engine, "/admin/panel/custom.css", false); anon.Body.String() == "panel{}" {
		t.Fatal("panel stylesheet must require a session")
	}
	if authed := get(engine, "/admin/panel/custom.css", true); authed.Body.String() != "panel{}" {
		t.Fatalf("panel css = %q, want panel{}", authed.Body.String())
	}
}

func TestEmptyCustomCssAddsNoLink(t *testing.T) {
	engine := newCustomCssTestEngine(t, nil)
	if body := get(engine, "/admin/", false).Body.String(); strings.Contains(body, "fullboard-custom-css") {
		t.Fatalf("empty custom CSS must not add a link: %s", body)
	}
}
