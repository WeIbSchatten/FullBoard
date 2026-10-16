import { useTranslation } from 'react-i18next';
import { Tooltip } from 'antd';
import { MoonFilled, MoonOutlined, SunOutlined } from '@ant-design/icons';

import { pauseAnimationsUntilLeave, useTheme, type ThemeMode } from '@/hooks/useTheme';
import './ThemeSwitch.css';

const MODES: { mode: ThemeMode; icon: React.ReactNode; labelKey: string }[] = [
  { mode: 'light', icon: <SunOutlined />, labelKey: 'menu.themeLight' },
  { mode: 'dark', icon: <MoonOutlined />, labelKey: 'menu.themeDark' },
  { mode: 'amoled', icon: <MoonFilled />, labelKey: 'menu.themeAmoled' },
];

export default function ThemeSwitch({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();

  if (compact) {
    const idx = MODES.findIndex((m) => m.mode === mode);
    const current = MODES[idx];
    const next = MODES[(idx + 1) % MODES.length];
    return (
      <Tooltip title={`${t('menu.theme')}: ${t(current.labelKey)}`} placement="right">
        <button
          id="theme-cycle"
          type="button"
          className="theme-switch-cycle"
          aria-label={t('menu.theme')}
          onClick={() => {
            pauseAnimationsUntilLeave('theme-cycle');
            setMode(next.mode);
          }}
        >
          {current.icon}
        </button>
      </Tooltip>
    );
  }

  return (
    <div className="theme-switch" role="radiogroup" aria-label={t('menu.theme')} id="theme-switch">
      {MODES.map((m) => (
        <Tooltip key={m.mode} title={t(m.labelKey)}>
          <button
            type="button"
            role="radio"
            aria-checked={mode === m.mode}
            aria-label={t(m.labelKey)}
            className={`theme-switch-item${mode === m.mode ? ' is-active' : ''}`}
            onClick={() => {
              pauseAnimationsUntilLeave('theme-switch');
              setMode(m.mode);
            }}
          >
            {m.icon}
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
