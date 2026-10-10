package service

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"strings"

	"github.com/WeIbSchatten/FullBoard/v3/internal/util/common"
	"github.com/WeIbSchatten/FullBoard/v3/internal/web/entity"
)

// MaxCustomCssBytes bounds each operator stylesheet; it is re-sent on every page load.
const MaxCustomCssBytes = 64 << 10

const (
	customCssActiveDefault = "default"
	maxCustomCssPresets    = 2
	defaultCustomCssBundle = `{"active":"default","presets":[]}`
)

// CustomCssPreset is one named pair of panel/login stylesheets.
type CustomCssPreset struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Panel string `json:"panel"`
	Login string `json:"login"`
}

// CustomCssBundle stores up to two presets plus which sheet is live.
type CustomCssBundle struct {
	Active  string            `json:"active"`
	Presets []CustomCssPreset `json:"presets"`
}

func defaultCustomCssBundleValue() CustomCssBundle {
	return CustomCssBundle{Active: customCssActiveDefault, Presets: []CustomCssPreset{}}
}

func ParseCustomCssBundle(raw string) CustomCssBundle {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return defaultCustomCssBundleValue()
	}
	var b CustomCssBundle
	if err := json.Unmarshal([]byte(raw), &b); err != nil {
		return defaultCustomCssBundleValue()
	}
	if b.Presets == nil {
		b.Presets = []CustomCssPreset{}
	}
	if b.Active == "" {
		b.Active = customCssActiveDefault
	}
	return b
}

func EncodeCustomCssBundle(b CustomCssBundle) (string, error) {
	if b.Presets == nil {
		b.Presets = []CustomCssPreset{}
	}
	if b.Active == "" {
		b.Active = customCssActiveDefault
	}
	raw, err := json.Marshal(b)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

func (b CustomCssBundle) activePreset() *CustomCssPreset {
	if b.Active == "" || b.Active == customCssActiveDefault {
		return nil
	}
	for i := range b.Presets {
		if b.Presets[i].ID == b.Active {
			return &b.Presets[i]
		}
	}
	return nil
}

func (b CustomCssBundle) ActivePanelCSS() string {
	if p := b.activePreset(); p != nil {
		return p.Panel
	}
	return ""
}

func (b CustomCssBundle) ActiveLoginCSS() string {
	if p := b.activePreset(); p != nil {
		return p.Login
	}
	return ""
}

func newPresetID() string {
	var buf [8]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return hex.EncodeToString([]byte("fallback"))
	}
	return hex.EncodeToString(buf[:])
}

// migrateCustomCssBundleIntoSetting lifts legacy flat CSS into one "Imported" preset.
func migrateCustomCssBundleIntoSetting(all *entity.AllSetting) bool {
	b := ParseCustomCssBundle(all.CustomCssBundle)
	if len(b.Presets) > 0 {
		return false
	}
	panel := strings.TrimSpace(all.CustomCss)
	login := strings.TrimSpace(all.CustomLoginCss)
	if panel == "" && login == "" {
		return false
	}
	b.Presets = []CustomCssPreset{{
		ID:    newPresetID(),
		Name:  "Imported",
		Panel: panel,
		Login: login,
	}}
	b.Active = b.Presets[0].ID
	encoded, err := EncodeCustomCssBundle(b)
	if err != nil {
		return false
	}
	all.CustomCssBundle = encoded
	all.CustomCss = panel
	all.CustomLoginCss = login
	return true
}

func (s *SettingService) GetCustomCss() (string, error) {
	b, err := s.resolvedCustomCssBundle()
	if err != nil {
		return "", err
	}
	return b.ActivePanelCSS(), nil
}

func (s *SettingService) GetCustomLoginCss() (string, error) {
	b, err := s.resolvedCustomCssBundle()
	if err != nil {
		return "", err
	}
	return b.ActiveLoginCSS(), nil
}

func (s *SettingService) resolvedCustomCssBundle() (CustomCssBundle, error) {
	raw, err := s.getString("customCssBundle")
	if err != nil {
		return defaultCustomCssBundleValue(), err
	}
	b := ParseCustomCssBundle(raw)
	if len(b.Presets) > 0 {
		return b, nil
	}
	panel, _ := s.getString("customCss")
	login, _ := s.getString("customLoginCss")
	all := &entity.AllSetting{CustomCssBundle: raw, CustomCss: panel, CustomLoginCss: login}
	if migrateCustomCssBundleIntoSetting(all) {
		_ = s.setString("customCssBundle", all.CustomCssBundle)
		return ParseCustomCssBundle(all.CustomCssBundle), nil
	}
	return b, nil
}

func validateCustomCssSettings(allSetting *entity.AllSetting) error {
	migrateCustomCssBundleIntoSetting(allSetting)
	b := ParseCustomCssBundle(allSetting.CustomCssBundle)
	if len(b.Presets) > maxCustomCssPresets {
		return common.NewErrorf("custom CSS presets: at most %d allowed", maxCustomCssPresets)
	}
	ids := map[string]bool{}
	for i := range b.Presets {
		p := &b.Presets[i]
		if strings.TrimSpace(p.ID) == "" {
			p.ID = newPresetID()
		}
		if ids[p.ID] {
			return common.NewError("custom CSS presets: duplicate id")
		}
		ids[p.ID] = true
		if strings.TrimSpace(p.Name) == "" {
			return common.NewError("custom CSS presets: name is required")
		}
		panel, err := NormalizeCustomCss(p.Panel)
		if err != nil {
			return common.NewError("custom CSS preset panel", err.Error())
		}
		login, err := NormalizeCustomCss(p.Login)
		if err != nil {
			return common.NewError("custom CSS preset login", err.Error())
		}
		p.Panel, p.Login = panel, login
	}
	if b.Active != customCssActiveDefault && !ids[b.Active] {
		b.Active = customCssActiveDefault
	}
	encoded, err := EncodeCustomCssBundle(b)
	if err != nil {
		return err
	}
	allSetting.CustomCssBundle = encoded
	// Keep flat fields mirrored to the active sheet for older clients / remote sync.
	allSetting.CustomCss = b.ActivePanelCSS()
	allSetting.CustomLoginCss = b.ActiveLoginCSS()
	return nil
}

// NormalizeCustomCss trims an operator stylesheet and rejects input that cannot be
// plain CSS. It is only ever served as text/css, never inlined into HTML.
func NormalizeCustomCss(css string) (string, error) {
	css = strings.TrimSpace(css)
	if len(css) > MaxCustomCssBytes {
		return "", common.NewErrorf("must not exceed %d bytes", MaxCustomCssBytes)
	}
	if strings.ContainsRune(css, 0) {
		return "", common.NewError("must not contain NUL bytes")
	}
	return css, nil
}
