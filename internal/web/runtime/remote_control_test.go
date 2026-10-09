package runtime

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/WeIbSchatten/FullBoard/v3/internal/database/model"
)

type recordedCall struct {
	method string
	path   string
	form   map[string][]string
	file   string
	fileNm string
}

func controlNode(t *testing.T, respond func(w http.ResponseWriter, req *http.Request)) (*Remote, *recordedCall) {
	t.Helper()
	rec := &recordedCall{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		rec.method, rec.path = req.Method, req.URL.EscapedPath()
		if strings.HasPrefix(req.Header.Get("Content-Type"), "multipart/") {
			if err := req.ParseMultipartForm(1 << 20); err != nil {
				t.Errorf("ParseMultipartForm: %v", err)
			}
			if f, hdr, err := req.FormFile("db"); err == nil {
				b, _ := io.ReadAll(f)
				rec.file, rec.fileNm = string(b), hdr.Filename
			}
			rec.form = req.MultipartForm.Value
		} else {
			_ = req.ParseForm()
			rec.form = req.PostForm
		}
		respond(w, req)
	}))
	t.Cleanup(srv.Close)
	return NewRemote(nodeForPlainServer(t, srv, "verify", "tok"), nil), rec
}

func okEnvelope(obj string) func(w http.ResponseWriter, _ *http.Request) {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"obj":` + obj + `}`))
	}
}

func TestRemoteGetXraySettingReturnsNodeObject(t *testing.T) {
	r, rec := controlNode(t, okEnvelope(`{"xraySetting":{"log":{}},"outboundTestUrl":"u"}`))
	raw, err := r.GetXraySetting(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if rec.method != http.MethodPost || rec.path != "/panel/api/xray/" {
		t.Fatalf("called %s %s, want POST /panel/api/xray/", rec.method, rec.path)
	}
	if string(raw) != `{"xraySetting":{"log":{}},"outboundTestUrl":"u"}` {
		t.Fatalf("obj = %s, want the node's object verbatim", raw)
	}
}

func TestRemoteUpdateXraySettingSendsFormFields(t *testing.T) {
	r, rec := controlNode(t, okEnvelope(`null`))
	if err := r.UpdateXraySetting(context.Background(), `{"log":{}}`, "https://probe.example"); err != nil {
		t.Fatal(err)
	}
	if rec.path != "/panel/api/xray/update" {
		t.Fatalf("path = %s", rec.path)
	}
	if got := rec.form["xraySetting"]; len(got) != 1 || got[0] != `{"log":{}}` {
		t.Fatalf("xraySetting = %v", got)
	}
	if got := rec.form["outboundTestUrl"]; len(got) != 1 || got[0] != "https://probe.example" {
		t.Fatalf("outboundTestUrl = %v", got)
	}
}

func TestRemoteGetPanelLogsPostsCountLevelAndSyslog(t *testing.T) {
	r, rec := controlNode(t, okEnvelope(`["line one","line two"]`))
	lines, err := r.GetPanelLogs(context.Background(), 250, "warning", true)
	if err != nil {
		t.Fatal(err)
	}
	if rec.path != "/panel/api/server/logs/250" {
		t.Fatalf("path = %s", rec.path)
	}
	if rec.form["level"][0] != "warning" || rec.form["syslog"][0] != "true" {
		t.Fatalf("form = %v, want level=warning syslog=true", rec.form)
	}
	if len(lines) != 2 || lines[1] != "line two" {
		t.Fatalf("lines = %v", lines)
	}
}

func TestRemoteGetXrayLogsPostsCountAndFilter(t *testing.T) {
	r, rec := controlNode(t, okEnvelope(`[{"Email":"a@b"}]`))
	raw, err := r.GetXrayLogs(context.Background(), 50, "a@b")
	if err != nil {
		t.Fatal(err)
	}
	if rec.path != "/panel/api/server/xraylogs/50" || rec.form["filter"][0] != "a@b" {
		t.Fatalf("called %s form=%v", rec.path, rec.form)
	}
	if string(raw) != `[{"Email":"a@b"}]` {
		t.Fatalf("obj = %s", raw)
	}
}

func TestRemoteStopInstallAndGeofilePaths(t *testing.T) {
	cases := []struct {
		name string
		run  func(r *Remote) error
		want string
	}{
		{"StopXray", func(r *Remote) error { return r.StopXray(context.Background()) }, "/panel/api/server/stopXrayService"},
		{"InstallXray escapes the version", func(r *Remote) error { return r.InstallXray(context.Background(), "v25.1.1/../x") }, "/panel/api/server/installXray/v25.1.1%2F..%2Fx"},
		{"UpdateGeofile all", func(r *Remote) error { return r.UpdateGeofile(context.Background(), "") }, "/panel/api/server/updateGeofile"},
		{"UpdateGeofile one", func(r *Remote) error { return r.UpdateGeofile(context.Background(), "geoip.dat") }, "/panel/api/server/updateGeofile/geoip.dat"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r, rec := controlNode(t, okEnvelope(`null`))
			if err := c.run(r); err != nil {
				t.Fatal(err)
			}
			if rec.method != http.MethodPost || rec.path != c.want {
				t.Fatalf("called %s %s, want POST %s", rec.method, rec.path, c.want)
			}
		})
	}
}

func TestRemoteGetBackupReturnsRawBytesNotEnvelope(t *testing.T) {
	payload := "SQLite format 3\x00\x01\x02 not json"
	r, rec := controlNode(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/octet-stream")
		_, _ = w.Write([]byte(payload))
	})
	got, err := r.GetBackup(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if rec.method != http.MethodGet || rec.path != "/panel/api/server/getDb" {
		t.Fatalf("called %s %s", rec.method, rec.path)
	}
	if string(got) != payload {
		t.Fatalf("backup bytes altered: %q", got)
	}
}

func TestRemoteGetBackupSurfacesHTTPFailure(t *testing.T) {
	r, _ := controlNode(t, func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "forbidden", http.StatusForbidden)
	})
	if _, err := r.GetBackup(context.Background()); err == nil || !strings.Contains(err.Error(), "HTTP 403") {
		t.Fatalf("err = %v, want an HTTP 403 error", err)
	}
}

func TestRemoteImportBackupUploadsMultipartDbField(t *testing.T) {
	r, rec := controlNode(t, okEnvelope(`null`))
	if err := r.ImportBackup(context.Background(), []byte("db-bytes"), true); err != nil {
		t.Fatal(err)
	}
	if rec.path != "/panel/api/server/importDB" {
		t.Fatalf("path = %s", rec.path)
	}
	if rec.file != "db-bytes" || rec.fileNm == "" {
		t.Fatalf("uploaded file = %q named %q", rec.file, rec.fileNm)
	}
	if rec.form["keepHostSettings"][0] != "true" {
		t.Fatalf("keepHostSettings = %v", rec.form["keepHostSettings"])
	}
}

func TestRemoteImportBackupCanCloneHostSettings(t *testing.T) {
	r, rec := controlNode(t, okEnvelope(`null`))
	if err := r.ImportBackup(context.Background(), []byte("x"), false); err != nil {
		t.Fatal(err)
	}
	if rec.form["keepHostSettings"][0] != "false" {
		t.Fatalf("keepHostSettings = %v, want false so the node does not silently keep host settings", rec.form["keepHostSettings"])
	}
}

func TestRemoteIssueLoginTicketReturnsTicket(t *testing.T) {
	r, rec := controlNode(t, okEnvelope(`{"ticket":"abc123","expiresIn":45}`))
	ticket, err := r.IssueLoginTicket(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if rec.method != http.MethodPost || rec.path != "/panel/api/setting/loginTicket" {
		t.Fatalf("called %s %s", rec.method, rec.path)
	}
	if ticket != "abc123" {
		t.Fatalf("ticket = %q", ticket)
	}
}

func TestRemoteIssueLoginTicketRejectsEmptyTicket(t *testing.T) {
	r, _ := controlNode(t, okEnvelope(`{"ticket":""}`))
	if _, err := r.IssueLoginTicket(context.Background()); err == nil {
		t.Fatal("an empty ticket from the node must be an error, not a login URL")
	}
}

func TestRemoteLoginURLKeepsTicketInFragment(t *testing.T) {
	r := NewRemote(&model.Node{Scheme: "https", Address: "node.example.com", Port: 2053, BasePath: "/secret"}, nil)
	got, err := r.LoginURL("a+b/c=")
	if err != nil {
		t.Fatal(err)
	}
	if want := "https://node.example.com:2053/secret/#loginTicket=a%2Bb%2Fc%3D"; got != want {
		t.Fatalf("LoginURL = %q, want %q", got, want)
	}
	u, _ := url.Parse(got)
	if u.RawQuery != "" || strings.Contains(u.Path, "a%2Bb") {
		t.Fatalf("ticket leaked outside the fragment: %q", got)
	}
}

type deadlineRecorder struct{ remaining time.Duration }

func (d *deadlineRecorder) RoundTrip(req *http.Request) (*http.Response, error) {
	if dl, ok := req.Context().Deadline(); ok {
		d.remaining = time.Until(dl)
	}
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{},
		Body:       io.NopCloser(strings.NewReader(`{"success":true,"obj":null}`)),
		Request:    req,
	}, nil
}

// An egress-bridge node's cached client carries a 10s Timeout; a slow op (Xray
// install, backup) must outlive it without loosening the cap for quick calls.
func TestRemoteSlowOpOutlivesProxyClientTimeoutOnly(t *testing.T) {
	rec := &deadlineRecorder{}
	r := NewRemote(&model.Node{Scheme: "http", Address: "node.example.com", Port: 2053, BasePath: "/", ApiToken: "tok"}, nil)
	r.clientOnce.Do(func() { r.client = &http.Client{Transport: rec, Timeout: remoteHTTPTimeout} })

	if err := r.InstallXray(context.Background(), "v25.1.1"); err != nil {
		t.Fatal(err)
	}
	if rec.remaining < time.Minute {
		t.Fatalf("slow op deadline = %s, want it to outlive the client's 10s Timeout", rec.remaining)
	}
	if err := r.StopXray(context.Background()); err != nil {
		t.Fatal(err)
	}
	if rec.remaining > remoteHTTPTimeout {
		t.Fatalf("quick call deadline = %s, want at most %s", rec.remaining, remoteHTTPTimeout)
	}
}