package runtime

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/url"
	"strconv"
)

// GetServerStatus reads the node panel's live status (CPU, memory, Xray state,
// versions) as the node serialized it, so new status fields pass through.
func (r *Remote) GetServerStatus(ctx context.Context) (json.RawMessage, error) {
	env, err := r.do(ctx, http.MethodGet, "panel/api/server/status", nil)
	if err != nil {
		return nil, err
	}
	return env.Obj, nil
}

// GetPanelSettings reads the node panel's settings in their browser-safe view:
// secrets come back blank with has* flags, so a round-trip never leaks them.
// Requires an admin-scope token on the node.
func (r *Remote) GetPanelSettings(ctx context.Context) (json.RawMessage, error) {
	env, err := r.do(ctx, http.MethodPost, "panel/api/setting/all", nil)
	if err != nil {
		return nil, err
	}
	return env.Obj, nil
}

// UpdatePanelSettings saves a full settings object on the node; blank secrets
// mean "unchanged" there. Requires an admin-scope token on the node.
func (r *Remote) UpdatePanelSettings(ctx context.Context, settings json.RawMessage) error {
	var probe map[string]json.RawMessage
	if err := json.Unmarshal(settings, &probe); err != nil || probe == nil {
		return errors.New("remote settings must be a JSON object")
	}
	_, err := r.do(ctx, http.MethodPost, "panel/api/setting/update", settings)
	return err
}

// RestartPanel asks the node panel to restart itself. Requires an admin-scope
// token on the node.
func (r *Remote) RestartPanel(ctx context.Context) error {
	_, err := r.do(ctx, http.MethodPost, "panel/api/setting/restartPanel", nil)
	return err
}

// GetXraySetting reads the node Xray template (+ inbound tags). Requires admin
// scope. Unwraps the JSON-string obj the panel uses for the frontend contract.
func (r *Remote) GetXraySetting(ctx context.Context) (json.RawMessage, error) {
	env, err := r.do(ctx, http.MethodPost, "panel/api/xray/", nil)
	if err != nil {
		return nil, err
	}
	var asString string
	if err := json.Unmarshal(env.Obj, &asString); err == nil {
		if asString == "" {
			return nil, errors.New("remote returned an empty xray setting payload")
		}
		return json.RawMessage(asString), nil
	}
	return env.Obj, nil
}

// UpdateXraySetting saves the node's Xray template; the node restarts a running
// core itself. Requires an admin-scope token on the node.
func (r *Remote) UpdateXraySetting(ctx context.Context, xraySetting, outboundTestURL string) error {
	_, err := r.do(ctx, http.MethodPost, "panel/api/xray/update", url.Values{
		"xraySetting":     {xraySetting},
		"outboundTestUrl": {outboundTestURL},
	})
	return err
}

// GetPanelLogs reads the node panel's own log tail. Requires an admin-scope
// token on the node.
func (r *Remote) GetPanelLogs(ctx context.Context, count int, level string, syslog bool) ([]string, error) {
	env, err := r.do(ctx, http.MethodPost, "panel/api/server/logs/"+strconv.Itoa(count), url.Values{
		"level":  {level},
		"syslog": {strconv.FormatBool(syslog)},
	})
	if err != nil {
		return nil, err
	}
	var lines []string
	if len(env.Obj) > 0 {
		if err := json.Unmarshal(env.Obj, &lines); err != nil {
			return nil, fmt.Errorf("decode panel logs: %w", err)
		}
	}
	return lines, nil
}

// GetXrayLogs reads the node's Xray access-log entries as the node serialized
// them. Requires an admin-scope token on the node.
func (r *Remote) GetXrayLogs(ctx context.Context, count int, filter string) (json.RawMessage, error) {
	env, err := r.do(ctx, http.MethodPost, "panel/api/server/xraylogs/"+strconv.Itoa(count), url.Values{
		"filter": {filter},
	})
	if err != nil {
		return nil, err
	}
	return env.Obj, nil
}

// StopXray stops the node's Xray core. Requires an admin-scope token on the node.
func (r *Remote) StopXray(ctx context.Context) error {
	_, err := r.do(ctx, http.MethodPost, "panel/api/server/stopXrayService", nil)
	return err
}

// InstallXray switches the node's Xray core to version; the node checks it
// against its own release list. Requires an admin-scope token on the node.
func (r *Remote) InstallXray(ctx context.Context, version string) error {
	_, err := r.do(withSlowOp(ctx), http.MethodPost, "panel/api/server/installXray/"+url.PathEscape(version), nil)
	return err
}

// UpdateGeofile refreshes one geo file on the node, or all of them when
// fileName is empty. Requires an admin-scope token on the node.
func (r *Remote) UpdateGeofile(ctx context.Context, fileName string) error {
	path := "panel/api/server/updateGeofile"
	if fileName != "" {
		path += "/" + url.PathEscape(fileName)
	}
	_, err := r.do(withSlowOp(ctx), http.MethodPost, path, nil)
	return err
}

// GetBackup downloads the node's database file. The node answers with the raw
// file, not a JSON envelope. Requires an admin-scope token on the node.
func (r *Remote) GetBackup(ctx context.Context) ([]byte, error) {
	return r.send(withSlowOp(ctx), http.MethodGet, "panel/api/server/getDb", nil)
}

// ImportBackup uploads a database file to the node, which replaces its data and
// restarts. keepHostSettings=false clones the source machine wholesale.
// Requires an admin-scope token on the node.
func (r *Remote) ImportBackup(ctx context.Context, db []byte, keepHostSettings bool) error {
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	part, err := w.CreateFormFile("db", "fullboard.db")
	if err != nil {
		return err
	}
	if _, err := part.Write(db); err != nil {
		return err
	}
	if err := w.WriteField("keepHostSettings", strconv.FormatBool(keepHostSettings)); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	_, err = r.do(withSlowOp(ctx), http.MethodPost, "panel/api/server/importDB", multipartBody{
		contentType: w.FormDataContentType(),
		data:        buf.Bytes(),
	})
	return err
}

// IssueLoginTicket asks the node for a short-lived single-use ticket that logs
// a browser into the node panel. The node only issues it to an admin-scope token.
func (r *Remote) IssueLoginTicket(ctx context.Context) (string, error) {
	env, err := r.do(ctx, http.MethodPost, "panel/api/setting/loginTicket", nil)
	if err != nil {
		return "", err
	}
	var out struct {
		Ticket string `json:"ticket"`
	}
	if err := json.Unmarshal(env.Obj, &out); err != nil {
		return "", fmt.Errorf("decode login ticket: %w", err)
	}
	if out.Ticket == "" {
		return "", errors.New("remote returned an empty login ticket")
	}
	return out.Ticket, nil
}

// LoginURL is the node panel's login page carrying ticket in the URL fragment,
// which browsers never send to servers or in Referer headers.
func (r *Remote) LoginURL(ticket string) (string, error) {
	base, err := r.baseURL()
	if err != nil {
		return "", err
	}
	return base + "#loginTicket=" + url.QueryEscape(ticket), nil
}
