import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, Space, Table, Tag, Typography, Upload, Input } from 'antd';
import type { UploadProps } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { keys } from '@/api/queryKeys';
import { HttpUtil } from '@/utils';
import { getMessage } from '@/utils/messageBus';
import { parseMsg } from '@/utils/zodValidate';
import { PublicSiteSnapshotSchema } from '@/generated/zod';
import type { PublicSiteSnapshot, RelayApplyResult } from '@/generated/types';
import type { Msg } from '@/utils';
import { reportApply } from './ProfilesTab';

const BASE = '/panel/api/tgWebProxy';

async function fetchPublicSite(): Promise<PublicSiteSnapshot> {
  const msg = await HttpUtil.get(`${BASE}/publicSite`, undefined, { silent: true });
  if (!msg?.success) throw new Error(msg?.msg || 'Failed to load public site');
  const validated = parseMsg(msg, PublicSiteSnapshotSchema, 'tgWebProxy/publicSite');
  if (!validated.obj) throw new Error('Empty public site');
  return validated.obj;
}

export default function PublicSiteTab({ disabled }: { disabled?: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const siteQuery = useQuery({
    queryKey: keys.tgWebProxy.publicSite(),
    queryFn: fetchPublicSite,
  });
  const site = siteQuery.data;
  // null = follow server snapshot; string = unsaved local edits
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const html = draft ?? site?.indexHtml ?? '';

  const save = async () => {
    setSaving(true);
    try {
      const msg = (await HttpUtil.post<RelayApplyResult>(
        `${BASE}/publicSite`,
        { indexHtml: html },
        { headers: { 'Content-Type': 'application/json' } },
      )) as Msg<RelayApplyResult> | undefined;
      reportApply(msg, t);
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: keys.tgWebProxy.root() });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      const msg = (await HttpUtil.post<RelayApplyResult>(`${BASE}/publicSite/reset`)) as
        | Msg<RelayApplyResult>
        | undefined;
      reportApply(msg, t);
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: keys.tgWebProxy.root() });
    } finally {
      setSaving(false);
    }
  };

  const uploadProps: UploadProps = {
    showUploadList: false,
    disabled: disabled || saving,
    beforeUpload: async (file) => {
      const form = new FormData();
      form.append('file', file);
      form.append('name', file.name);
      const msg = await HttpUtil.post(`${BASE}/publicSite/upload`, form);
      if (msg?.success) {
        getMessage().success(t('pages.tgWebProxy.toasts.saved'));
        await queryClient.invalidateQueries({ queryKey: keys.tgWebProxy.publicSite() });
      }
      return false;
    },
  };

  const removeAsset = async (name: string) => {
    const msg = await HttpUtil.post(`${BASE}/publicSite/del/${encodeURIComponent(name)}`);
    if (msg?.success) {
      getMessage().success(t('pages.tgWebProxy.toasts.deleted'));
      await queryClient.invalidateQueries({ queryKey: keys.tgWebProxy.publicSite() });
    }
  };

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        title={t('pages.tgWebProxy.publicSite.hint')}
        description={
          site ? (
            <span>
              {t('pages.tgWebProxy.publicSite.dir')}: <code>{site.dir}</code>{' '}
              {site.active ? (
                <Tag color="success">{t('pages.tgWebProxy.publicSite.active')}</Tag>
              ) : (
                <Tag>{t('pages.tgWebProxy.publicSite.inactive')}</Tag>
              )}
            </span>
          ) : null
        }
      />
      <Card
        title={t('pages.tgWebProxy.publicSite.editor')}
        extra={
          <Space>
            <Button disabled={disabled || saving} onClick={reset}>
              {t('pages.tgWebProxy.publicSite.reset')}
            </Button>
            <Button type="primary" disabled={disabled || saving} loading={saving} onClick={save}>
              {t('pages.tgWebProxy.publicSite.save')}
            </Button>
          </Space>
        }
      >
        <Input.TextArea
          value={html}
          onChange={(e) => setDraft(e.target.value)}
          rows={16}
          disabled={disabled}
          style={{ fontFamily: 'var(--fb-font-mono)' }}
        />
      </Card>
      <Card title={t('pages.tgWebProxy.publicSite.preview')}>
        <iframe
          title="public-site-preview"
          sandbox=""
          srcDoc={html}
          style={{
            width: '100%',
            height: 320,
            border: '1px solid var(--fb-border)',
            borderRadius: 12,
            background: '#fff',
          }}
        />
      </Card>
      <Card
        title={t('pages.tgWebProxy.publicSite.assets')}
        extra={
          <Upload {...uploadProps}>
            <Button disabled={disabled}>{t('pages.tgWebProxy.publicSite.upload')}</Button>
          </Upload>
        }
      >
        <Table
          size="small"
          rowKey="name"
          loading={siteQuery.isFetching}
          pagination={false}
          dataSource={site?.files ?? []}
          columns={[
            { title: t('pages.tgWebProxy.profile.name'), dataIndex: 'name' },
            {
              title: t('pages.tgWebProxy.publicSite.size'),
              dataIndex: 'size',
              render: (n: number) => `${n} B`,
            },
            {
              title: '',
              key: 'actions',
              render: (_: unknown, row: { name: string }) =>
                row.name === 'index.html' ? (
                  <Typography.Text type="secondary">—</Typography.Text>
                ) : (
                  <Button
                    type="link"
                    danger
                    disabled={disabled}
                    onClick={() => removeAsset(row.name)}
                  >
                    {t('delete')}
                  </Button>
                ),
            },
          ]}
        />
      </Card>
    </Space>
  );
}
