import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Checkbox, Input, Radio, Select, Space, Switch, Typography } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';

import type { AllSetting } from '@/models/setting';
import { SettingListItem } from '@/components/ui';
import { writeCachedNavPosition, type NavPosition } from '@/layouts/NavLayoutContext';
import {
  DEFAULT_NAV_VISIBILITY,
  HIDEABLE_NAV_KEYS,
  parseNavVisibility,
  type NavVisibility,
} from '@/lib/navVisibility';

export const CUSTOM_CSS_MAX_BYTES = 64 * 1024;
const PREVIEW_STYLE_ID = 'fullboard-custom-css-preview';
const MAX_PRESETS = 2;
const DEFAULT_BUNDLE = '{"active":"default","presets":[]}';

export type CssPreset = { id: string; name: string; panel: string; login: string };
export type CssBundle = {
  active: string;
  presets: CssPreset[];
  navVisibility?: { hidden?: string[]; showRouting?: boolean };
};

export function cssByteLength(css: string): number {
  return new TextEncoder().encode(css).length;
}

export function parseCssBundle(raw: string | undefined): CssBundle {
  try {
    const parsed = JSON.parse(raw || DEFAULT_BUNDLE) as CssBundle;
    return {
      active: parsed.active || 'default',
      presets: Array.isArray(parsed.presets) ? parsed.presets.slice(0, MAX_PRESETS) : [],
      navVisibility: parsed.navVisibility,
    };
  } catch {
    return { active: 'default', presets: [] };
  }
}

function encodeBundle(b: CssBundle): string {
  return JSON.stringify({
    active: b.active || 'default',
    presets: b.presets,
    ...(b.navVisibility ? { navVisibility: b.navVisibility } : {}),
  });
}

function newPresetId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  }
  return `p${Date.now().toString(36)}`;
}

// Live preview goes through textContent, so the stylesheet is never parsed as HTML.
function usePanelCssPreview(enabled: boolean, css: string) {
  useEffect(() => {
    if (!enabled) return;
    const el = document.createElement('style');
    el.id = PREVIEW_STYLE_ID;
    el.textContent = css;
    document.head.appendChild(el);
    return () => el.remove();
  }, [enabled, css]);
}

interface CustomCssSettingsProps {
  allSetting: AllSetting;
  updateSetting: (patch: Partial<AllSetting>) => void;
}

function CssEditor({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  const bytes = cssByteLength(value);
  return (
    <>
      <Input.TextArea
        value={value}
        rows={10}
        spellCheck={false}
        placeholder={placeholder}
        style={{ fontFamily: 'monospace' }}
        status={bytes > CUSTOM_CSS_MAX_BYTES ? 'error' : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      <Typography.Text type={bytes > CUSTOM_CSS_MAX_BYTES ? 'danger' : 'secondary'}>
        {t('pages.settings.customCss.size', { size: bytes, max: CUSTOM_CSS_MAX_BYTES })}
      </Typography.Text>
    </>
  );
}

export default function CustomCssSettings({ allSetting, updateSetting }: CustomCssSettingsProps) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState(false);
  const bundle = useMemo(
    () => parseCssBundle(allSetting.customCssBundle),
    [allSetting.customCssBundle],
  );
  const selectedId = bundle.active === 'default' ? 'default' : bundle.active;
  const selected = bundle.presets.find((p) => p.id === selectedId);
  const previewCss = selectedId === 'default' ? '' : (selected?.panel ?? allSetting.customCss);
  usePanelCssPreview(preview, previewCss);

  const commit = (next: CssBundle) => {
    const encoded = encodeBundle(next);
    const active = next.presets.find((p) => p.id === next.active);
    updateSetting({
      customCssBundle: encoded,
      customCss: active?.panel ?? '',
      customLoginCss: active?.login ?? '',
      navPosition: allSetting.navPosition === 'top' ? 'top' : 'side',
    });
  };

  const setActive = (id: string) => {
    commit({ ...bundle, active: id });
  };

  const createPreset = () => {
    if (bundle.presets.length >= MAX_PRESETS) return;
    const id = newPresetId();
    const name = t('pages.settings.customCss.presetName', { n: bundle.presets.length + 1 });
    commit({
      ...bundle,
      active: id,
      presets: [...bundle.presets, { id, name, panel: '', login: '' }],
    });
  };

  const renameSelected = (name: string) => {
    if (!selected) return;
    commit({
      ...bundle,
      presets: bundle.presets.map((p) => (p.id === selected.id ? { ...p, name } : p)),
    });
  };

  const patchSelected = (patch: Partial<Pick<CssPreset, 'panel' | 'login'>>) => {
    if (!selected) return;
    commit({
      ...bundle,
      presets: bundle.presets.map((p) => (p.id === selected.id ? { ...p, ...patch } : p)),
    });
  };

  const deleteSelected = () => {
    if (!selected) return;
    const presets = bundle.presets.filter((p) => p.id !== selected.id);
    commit({ active: 'default', presets, navVisibility: bundle.navVisibility });
  };

  const navVis = useMemo(() => parseNavVisibility(bundle.navVisibility), [bundle.navVisibility]);

  const setNavVis = (next: NavVisibility) => {
    commit({ ...bundle, navVisibility: next });
  };

  const navLabel = (key: string) => {
    switch (key) {
      case '/':
        return t('menu.dashboard');
      case '/connections':
        return t('menu.connections');
      case '/clients':
        return t('menu.clients');
      case '/groups':
        return t('menu.groups');
      case '/nodes':
        return t('menu.nodes');
      case '/hosts':
        return t('menu.hosts');
      case '/settings':
        return t('menu.settings');
      case '/xray':
        return t('menu.xray');
      case '/routing':
        return t('menu.routing');
      case '/api-docs':
        return t('menu.apiDocs');
      default:
        return key;
    }
  };

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ margin: '8px 0' }}
        title={t('pages.settings.customCss.intro')}
      />
      <SettingListItem
        paddings="small"
        title={t('pages.settings.navPosition')}
        description={t('pages.settings.navPositionDesc')}
      >
        <Radio.Group
          value={allSetting.navPosition === 'top' ? 'top' : 'side'}
          onChange={(e) => {
            const navPosition = e.target.value as NavPosition;
            writeCachedNavPosition(navPosition);
            updateSetting({ navPosition });
          }}
          optionType="button"
          options={[
            { value: 'side', label: t('pages.settings.navPositionSide') },
            { value: 'top', label: t('pages.settings.navPositionTop') },
          ]}
        />
      </SettingListItem>
      <SettingListItem
        paddings="small"
        title={t('pages.settings.customCss.navVisibility')}
        description={t('pages.settings.customCss.navVisibilityDesc')}
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          {HIDEABLE_NAV_KEYS.filter((k) => k !== '/routing').map((key) => {
            const hidden = navVis.hidden.includes(key);
            return (
              <Checkbox
                key={key}
                checked={!hidden}
                onChange={(e) => {
                  const show = e.target.checked;
                  const hiddenKeys = new Set(navVis.hidden);
                  if (show) hiddenKeys.delete(key);
                  else hiddenKeys.add(key);
                  setNavVis({ ...navVis, hidden: [...hiddenKeys] });
                }}
              >
                {navLabel(key)}
              </Checkbox>
            );
          })}
          <Checkbox
            checked={navVis.showRouting}
            onChange={(e) =>
              setNavVis({
                ...(navVis.hidden.length ? navVis : DEFAULT_NAV_VISIBILITY),
                hidden: navVis.hidden.filter((k) => k !== '/routing'),
                showRouting: e.target.checked,
              })
            }
          >
            {t('menu.routing')}
          </Checkbox>
        </Space>
      </SettingListItem>
      <SettingListItem
        paddings="small"
        title={t('pages.settings.customCss.preset')}
        description={t('pages.settings.customCss.presetDesc')}
      >
        <Space wrap>
          <Select
            style={{ minWidth: 200 }}
            value={selectedId}
            onChange={setActive}
            options={[
              { value: 'default', label: t('pages.settings.customCss.default') },
              ...bundle.presets.map((p, i) => ({
                value: p.id,
                label: p.name || t('pages.settings.customCss.presetName', { n: i + 1 }),
              })),
            ]}
          />
          <Button
            icon={<PlusOutlined />}
            disabled={bundle.presets.length >= MAX_PRESETS}
            onClick={createPreset}
          >
            {t('pages.settings.customCss.createPreset')}
          </Button>
          {selected && (
            <Button danger icon={<DeleteOutlined />} onClick={deleteSelected}>
              {t('pages.settings.customCss.deletePreset')}
            </Button>
          )}
        </Space>
      </SettingListItem>
      {selected && (
        <>
          <SettingListItem
            paddings="small"
            title={t('pages.settings.customCss.rename')}
            description={t('pages.settings.customCss.renameDesc')}
          >
            <Input
              value={selected.name}
              maxLength={64}
              onChange={(e) => renameSelected(e.target.value)}
            />
          </SettingListItem>
          <SettingListItem
            paddings="small"
            title={t('pages.settings.customCss.panel')}
            description={t('pages.settings.customCss.panelDesc')}
          >
            <CssEditor
              value={selected.panel}
              placeholder=".ant-layout-sider { background: #10162f; }"
              onChange={(v) => patchSelected({ panel: v })}
            />
          </SettingListItem>
          <SettingListItem
            paddings="small"
            title={t('pages.settings.customCss.preview')}
            description={t('pages.settings.customCss.previewDesc')}
          >
            <Switch checked={preview} onChange={setPreview} />
          </SettingListItem>
          <SettingListItem
            paddings="small"
            title={t('pages.settings.customCss.login')}
            description={t('pages.settings.customCss.loginDesc')}
          >
            <CssEditor
              value={selected.login}
              placeholder="body { background: linear-gradient(135deg, #10162f, #1f3b73); }"
              onChange={(v) => patchSelected({ login: v })}
            />
          </SettingListItem>
        </>
      )}
      {selectedId === 'default' && (
        <Alert
          type="success"
          showIcon
          style={{ margin: '8px 0' }}
          title={t('pages.settings.customCss.defaultHint')}
        />
      )}
    </>
  );
}
