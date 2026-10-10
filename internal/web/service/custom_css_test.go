package service

import (
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"

	"github.com/WeIbSchatten/FullBoard/v3/internal/database/dbtest"
)

func TestUpdateAllSettingCustomCss(t *testing.T) {
	dbtest.InitDB(t, filepath.Join(t.TempDir(), "x-ui.db"))
	s := &SettingService{}

	t.Run("oversized stylesheet is rejected", func(t *testing.T) {
		all, err := s.GetAllSetting()
		if err != nil {
			t.Fatal(err)
		}
		all.CustomCss = strings.Repeat("a", MaxCustomCssBytes+1)
		err = s.UpdateAllSetting(all, SecretClears{})
		if err == nil || !strings.Contains(err.Error(), "custom CSS") {
			t.Fatalf("err = %v, want custom CSS size error", err)
		}
		if got, _ := s.GetCustomCss(); got != "" {
			t.Fatalf("stored css = %d bytes, want nothing saved", len(got))
		}
	})

	t.Run("legacy flat stylesheets migrate into an active preset", func(t *testing.T) {
		all, err := s.GetAllSetting()
		if err != nil {
			t.Fatal(err)
		}
		all.CustomCssBundle = defaultCustomCssBundle
		all.CustomCss = "  .ant-layout{background:#000}\n"
		all.CustomLoginCss = "\n.login{}"
		if err := s.UpdateAllSetting(all, SecretClears{}); err != nil {
			t.Fatalf("UpdateAllSetting: %v", err)
		}
		if got, _ := s.GetCustomCss(); got != ".ant-layout{background:#000}" {
			t.Fatalf("panel css = %q", got)
		}
		if got, _ := s.GetCustomLoginCss(); got != ".login{}" {
			t.Fatalf("login css = %q", got)
		}
		raw, _ := s.getString("customCssBundle")
		b := ParseCustomCssBundle(raw)
		if len(b.Presets) != 1 || b.Presets[0].Name != "Imported" || b.Active != b.Presets[0].ID {
			t.Fatalf("bundle after migrate = %+v", b)
		}
	})
}

func TestCustomCssBundleActiveDefaultServesEmpty(t *testing.T) {
	dbtest.InitDB(t, filepath.Join(t.TempDir(), "x-ui.db"))
	s := &SettingService{}
	all, err := s.GetAllSetting()
	if err != nil {
		t.Fatal(err)
	}
	preset := CustomCssPreset{ID: "p1", Name: "Dream", Panel: ".panel{}", Login: ".login{}"}
	all.CustomCssBundle, err = EncodeCustomCssBundle(CustomCssBundle{
		Active:  customCssActiveDefault,
		Presets: []CustomCssPreset{preset},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := s.UpdateAllSetting(all, SecretClears{}); err != nil {
		t.Fatal(err)
	}
	if got, _ := s.GetCustomCss(); got != "" {
		t.Fatalf("default active must serve empty panel css, got %q", got)
	}
	all, _ = s.GetAllSetting()
	b := ParseCustomCssBundle(all.CustomCssBundle)
	b.Active = "p1"
	all.CustomCssBundle, _ = EncodeCustomCssBundle(b)
	if err := s.UpdateAllSetting(all, SecretClears{}); err != nil {
		t.Fatal(err)
	}
	if got, _ := s.GetCustomCss(); got != ".panel{}" {
		t.Fatalf("active preset panel = %q", got)
	}
}

func TestCustomCssBundleRejectsThirdPreset(t *testing.T) {
	dbtest.InitDB(t, filepath.Join(t.TempDir(), "x-ui.db"))
	s := &SettingService{}
	all, err := s.GetAllSetting()
	if err != nil {
		t.Fatal(err)
	}
	presets := []CustomCssPreset{
		{ID: "a", Name: "A", Panel: "a{}"},
		{ID: "b", Name: "B", Panel: "b{}"},
		{ID: "c", Name: "C", Panel: "c{}"},
	}
	raw, _ := json.Marshal(CustomCssBundle{Active: "a", Presets: presets})
	all.CustomCssBundle = string(raw)
	err = s.UpdateAllSetting(all, SecretClears{})
	if err == nil || !strings.Contains(err.Error(), "at most") {
		t.Fatalf("err = %v, want at most 2 presets", err)
	}
}
