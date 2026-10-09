package runtime

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
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
