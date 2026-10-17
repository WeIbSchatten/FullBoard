import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Popover, Segmented, Tooltip } from 'antd';
import { BgColorsOutlined, CheckOutlined } from '@ant-design/icons';

import {
  STYLE_PRESETS,
  UI_SCALES,
  autoUiScale,
  pauseAnimationsUntilLeave,
  useTheme,
  type StylePreset,
  type UiScale,
} from '@/hooks/useTheme';
import ThemeSwitch from './ThemeSwitch';
import './AppearancePanel.css';

// The account menu opens the appearance dialog through this event.
export const APPEARANCE_EVENT = 'fb:appearance';

// Swatches mirror the dark palette of each preset so the choice is visible before clicking.
const PRESET_SWATCHES: Record<StylePreset, string[]> = {
  mono: ['#0a0a0a', '#1b1b1b', '#8f8f8f', '#f5f5f5'],
  pastel: ['#f8ffa1', '#f6d5ee', '#a8a3f6', '#24316b'],
};

function useAutoPercent(): number {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return Math.round(autoUiScale(width) * 100);
}

export function AppearancePanel() {
  const { t } = useTranslation();
  const { stylePreset, setStylePreset, uiScale, setUiScale } = useTheme();
  const autoPercent = useAutoPercent();

  return (
    <div className="appearance-panel" id="appearance-panel">
      <section>
        <div className="appearance-label">{t('menu.appearance.style')}</div>
        <div
          className="appearance-presets"
          role="radiogroup"
          aria-label={t('menu.appearance.style')}
        >
          {STYLE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              role="radio"
              aria-checked={stylePreset === preset}
              className={`appearance-preset appearance-preset--${preset}${stylePreset === preset ? ' is-active' : ''}`}
              onClick={() => {
                pauseAnimationsUntilLeave('appearance-panel');
                setStylePreset(preset);
              }}
            >
              <span className="appearance-preset-art" aria-hidden>
                <span className="appearance-preset-aa">Aa</span>
                <span className="appearance-preset-swatches">
                  {PRESET_SWATCHES[preset].map((c) => (
                    <i key={c} style={{ background: c }} />
                  ))}
                </span>
              </span>
              <span className="appearance-preset-text">
                <b>{t(`menu.appearance.preset.${preset}`)}</b>
                <small>{t(`menu.appearance.preset.${preset}Hint`)}</small>
              </span>
              {stylePreset === preset && <CheckOutlined className="appearance-preset-check" />}
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="appearance-label">{t('menu.theme')}</div>
        <ThemeSwitch />
      </section>

      <section>
        <div className="appearance-label">{t('menu.appearance.size')}</div>
        <Segmented<UiScale>
          block
          size="small"
          value={uiScale}
          onChange={setUiScale}
          options={UI_SCALES.map((s) => ({
            value: s,
            label: s === 'auto' ? t('menu.appearance.sizeAuto') : `${s}%`,
          }))}
        />
        <div className="appearance-hint">
          {t('menu.appearance.sizeAutoHint', { percent: autoPercent })}
        </div>
      </section>
    </div>
  );
}

// Palette button that opens the appearance popover; used in the sidebar and login toolbar.
export function AppearanceButton({
  placement = 'rightBottom',
}: {
  placement?: 'rightBottom' | 'bottomRight' | 'top';
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <Popover
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement={placement}
      content={<AppearancePanel />}
      title={t('menu.appearance.title')}
      arrow={false}
    >
      <Tooltip title={open ? undefined : t('menu.appearance.title')} placement="right">
        <button type="button" className="appearance-button" aria-label={t('menu.appearance.title')}>
          <BgColorsOutlined />
        </button>
      </Tooltip>
    </Popover>
  );
}

export function AppearanceDialog() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(APPEARANCE_EVENT, show);
    return () => window.removeEventListener(APPEARANCE_EVENT, show);
  }, []);
  return (
    <Modal
      open={open}
      title={t('menu.appearance.title')}
      footer={null}
      width={380}
      onCancel={() => setOpen(false)}
    >
      <AppearancePanel />
    </Modal>
  );
}
