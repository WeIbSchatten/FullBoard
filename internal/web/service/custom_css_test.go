package service

import (
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
		if err == nil || !strings.Contains(err.Error(), "custom panel CSS") {
			t.Fatalf("err = %v, want custom panel CSS size error", err)
		}
		if got, _ := s.GetCustomCss(); got != "" {
			t.Fatalf("stored css = %d bytes, want nothing saved", len(got))
		}
	})

	t.Run("valid stylesheets persist trimmed", func(t *testing.T) {
		all, err := s.GetAllSetting()
		if err != nil {
			t.Fatal(err)
		}
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
	})
}
