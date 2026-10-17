package controller

import (
	"encoding/base64"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"

	"github.com/WeIbSchatten/FullBoard/v3/internal/database"
	"github.com/WeIbSchatten/FullBoard/v3/internal/database/model"
)

// The panel's HttpUtil.post sends form-encoded bodies, and a JSON-only bind
// answered every pasted invite with "request body failed validation".
func TestEnrollFromInviteAcceptsThePanelsFormEncodedPost(t *testing.T) {
	engine := newNodeCredentialTestEngine(t)
	child := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path != "/enroll/consume" {
			_, _ = w.Write([]byte(`{"success":true,"obj":{}}`))
			return
		}
		host, port, _ := net.SplitHostPort(r.Host)
		p, _ := strconv.Atoi(port)
		_ = json.NewEncoder(w).Encode(map[string]any{"success": true, "obj": map[string]any{
			"scheme": "http", "address": host, "port": p, "basePath": "/", "apiToken": "child-token", "name": "eu-relay",
		}})
	}))
	defer child.Close()
	payload, _ := json.Marshal(map[string]any{"v": 1, "base": child.URL + "/", "code": "one-shot"})
	invite := "fb-enroll-1." + base64.RawURLEncoding.EncodeToString(payload)

	form := url.Values{"invite": {invite}}
	req := httptest.NewRequest(http.MethodPost, "/panel/api/nodes/enrollFromInvite", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
	w := httptest.NewRecorder()
	engine.ServeHTTP(w, req)

	var resp struct {
		Success bool   `json:"success"`
		Msg     string `json:"msg"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil || !resp.Success {
		t.Fatalf("enroll response = %s (%v), want success", w.Body.String(), err)
	}
	var node model.Node
	if err := database.GetDB().Where("name = ?", "eu-relay").First(&node).Error; err != nil {
		t.Fatalf("enrolled node not stored: %v", err)
	}
}
