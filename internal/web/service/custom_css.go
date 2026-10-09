package service

import (
	"strings"

	"github.com/WeIbSchatten/FullBoard/v3/internal/util/common"
	"github.com/WeIbSchatten/FullBoard/v3/internal/web/entity"
)

// MaxCustomCssBytes bounds each operator stylesheet; it is re-sent on every page load.
const MaxCustomCssBytes = 64 << 10

func (s *SettingService) GetCustomCss() (string, error) {
	return s.getString("customCss")
}

func (s *SettingService) GetCustomLoginCss() (string, error) {
	return s.getString("customLoginCss")
}

func validateCustomCssSettings(allSetting *entity.AllSetting) error {
	for name, value := range map[string]*string{
		"custom panel CSS": &allSetting.CustomCss,
		"custom login CSS": &allSetting.CustomLoginCss,
	} {
		css, err := NormalizeCustomCss(*value)
		if err != nil {
			return common.NewError(name, err.Error())
		}
		*value = css
	}
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
