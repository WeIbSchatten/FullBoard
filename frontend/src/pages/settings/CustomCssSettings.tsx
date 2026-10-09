import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Input, Switch, Typography } from 'antd';

import type { AllSetting } from '@/models/setting';
import { SettingListItem } from '@/components/ui';

export const CUSTOM_CSS_MAX_BYTES = 64 * 1024;
const PREVIEW_STYLE_ID = 'fullboard-custom-css-preview';

export function cssByteLength(css: string): number {
  return new TextEncoder().encode(css).length;
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
  usePanelCssPreview(preview, allSetting.customCss);

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
        title={t('pages.settings.customCss.panel')}
        description={t('pages.settings.customCss.panelDesc')}
      >
        <CssEditor
          value={allSetting.customCss}
          placeholder=".ant-layout-sider { background: #10162f; }"
          onChange={(v) => updateSetting({ customCss: v })}
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
          value={allSetting.customLoginCss}
          placeholder="body { background: linear-gradient(135deg, #10162f, #1f3b73); }"
          onChange={(v) => updateSetting({ customLoginCss: v })}
        />
      </SettingListItem>
    </>
  );
}
