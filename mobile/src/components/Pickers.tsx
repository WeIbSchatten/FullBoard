import { Pressable, Text, View } from 'react-native';

import { Card, Title } from '@/components/ui';
import { LANGUAGES, useI18n } from '@/i18n';
import { STYLE_PRESETS, THEME_MODES, usePalette, useTheme, type ThemeMode } from '@/theme';

export function Chips<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: on ? p.accent : p.border,
              backgroundColor: on ? p.accent : p.surface2,
            }}
          >
            <Text style={{ color: on ? p.onAccent : p.text, fontWeight: on ? '600' : '400' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function LanguagePicker() {
  const { lang, setLang, t } = useI18n();
  return (
    <Card>
      <Title>{t('pages.settings.language')}</Title>
      <Chips options={LANGUAGES.map((l) => ({ value: l.value, label: l.name }))} value={lang} onChange={setLang} />
    </Card>
  );
}

const MODE_KEYS: Record<ThemeMode, string> = {
  system: 'menu.appearance.sizeAuto',
  light: 'menu.themeLight',
  dark: 'menu.themeDark',
  amoled: 'menu.themeAmoled',
};

export function AppearancePicker() {
  const { t } = useI18n();
  const { mode, setMode, style, setStyle } = useTheme();
  return (
    <Card>
      <Title>{t('menu.theme')}</Title>
      <Chips options={THEME_MODES.map((m) => ({ value: m, label: t(MODE_KEYS[m]) }))} value={mode} onChange={setMode} />
      <Title>{t('menu.appearance.style')}</Title>
      <Chips
        options={STYLE_PRESETS.map((s) => ({ value: s, label: t(`menu.appearance.preset.${s}`) }))}
        value={style}
        onChange={setStyle}
      />
    </Card>
  );
}
