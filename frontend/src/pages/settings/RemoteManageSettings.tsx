import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Space, Typography, message } from 'antd';
import { CopyOutlined, LinkOutlined } from '@ant-design/icons';

import { SettingListItem } from '@/components/ui';
import { useAllSettings } from '@/api/queries/useAllSettings';
import { HttpUtil } from '@/utils';

interface EnrollInviteResponse {
  invite?: string;
  expiresIn?: number;
  baseUrl?: string;
}

interface ApiMsg<T = unknown> {
  success?: boolean;
  msg?: string;
  obj?: T;
}

function guessPublicBase(webBasePath: string | undefined): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  if (!origin) return '';
  let path = (webBasePath || window.X_UI_BASE_PATH || '/').trim() || '/';
  if (!path.startsWith('/')) path = `/${path}`;
  if (!path.endsWith('/')) path += '/';
  return `${origin}${path === '/' ? '/' : path}`;
}

export default function RemoteManageSettings() {
  const { t } = useTranslation();
  const { allSetting } = useAllSettings();
  const [messageApi, contextHolder] = message.useMessage();
  const defaultBase = useMemo(
    () => guessPublicBase(allSetting.webBasePath),
    [allSetting.webBasePath],
  );
  const [publicBaseOverride, setPublicBaseOverride] = useState<string | null>(null);
  const publicBase = publicBaseOverride ?? defaultBase;
  const [invite, setInvite] = useState('');
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const issue = useCallback(async () => {
    setBusy(true);
    try {
      const base = publicBase.trim() || defaultBase;
      const msg = (await HttpUtil.post('/panel/api/setting/enrollInvite', {
        publicBase: base || undefined,
      })) as ApiMsg<EnrollInviteResponse>;
      if (msg?.success && msg.obj?.invite) {
        setInvite(msg.obj.invite);
        setExpiresIn(typeof msg.obj.expiresIn === 'number' ? msg.obj.expiresIn : null);
        if (msg.obj.baseUrl) setPublicBaseOverride(msg.obj.baseUrl);
        messageApi.success(t('pages.settings.remoteManage.issued'));
      } else {
        messageApi.error(msg?.msg || t('pages.settings.remoteManage.issueFailed'));
      }
    } catch {
      messageApi.error(t('pages.settings.remoteManage.issueFailed'));
    } finally {
      setBusy(false);
    }
  }, [publicBase, defaultBase, messageApi, t]);

  const copy = useCallback(async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite);
      messageApi.success(t('pages.settings.remoteManage.copied'));
    } catch {
      messageApi.error(t('somethingWentWrong'));
    }
  }, [invite, messageApi, t]);

  return (
    <>
      {contextHolder}
      <SettingListItem
        paddings="small"
        title={t('pages.settings.remoteManage.title')}
        description={t('pages.settings.remoteManage.desc')}
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Input
            prefix={<LinkOutlined />}
            value={publicBase}
            onChange={(e) => setPublicBaseOverride(e.target.value)}
            placeholder={defaultBase || t('pages.settings.remoteManage.publicBasePh')}
          />
          <Typography.Text type="secondary">
            {t('pages.settings.remoteManage.publicBaseDesc')}
          </Typography.Text>
          <Space wrap>
            <Button type="primary" loading={busy} onClick={issue}>
              {invite
                ? t('pages.settings.remoteManage.regenerate')
                : t('pages.settings.remoteManage.issue')}
            </Button>
            <Button icon={<CopyOutlined />} disabled={!invite} onClick={copy}>
              {t('pages.settings.remoteManage.copy')}
            </Button>
          </Space>
          {invite ? (
            <>
              <Input.TextArea
                rows={3}
                value={invite}
                readOnly
                style={{ fontFamily: 'monospace' }}
              />
              {expiresIn != null ? (
                <Typography.Text type="secondary">
                  {t('pages.settings.remoteManage.expiresIn', {
                    minutes: Math.max(1, Math.round(expiresIn / 60)),
                  })}
                </Typography.Text>
              ) : null}
            </>
          ) : null}
        </Space>
      </SettingListItem>
    </>
  );
}
