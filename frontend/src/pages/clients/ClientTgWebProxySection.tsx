import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Select, Space, Switch, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';

import { useNodesQuery } from '@/api/queries/useNodesQuery';
import {
  useTgWebProxyBindingMutations,
  useTgWebProxyBindings,
  useTgWebProxySnapshot,
} from '@/api/queries/useTgWebProxy';
import { keys } from '@/api/queryKeys';
import { isManagedProfile } from '@/lib/tgWebProxy';
import { HttpUtil } from '@/utils';
import { parseMsg } from '@/utils/zodValidate';
import { RelaySnapshotSchema } from '@/generated/zod';
import type { RelaySnapshot } from '@/generated/types';

async function fetchRemoteSnapshot(nodeId: number): Promise<RelaySnapshot> {
  const msg = await HttpUtil.get(`/panel/api/nodes/remote/${nodeId}/tgWebProxy/config`, undefined, {
    silent: true,
  });
  if (!msg?.success) throw new Error(msg?.msg || 'Failed to fetch remote tg-web-proxy config');
  const validated = parseMsg(msg, RelaySnapshotSchema, 'nodes/remote/tgWebProxy/config');
  if (!validated.obj) throw new Error('Empty remote tg-web-proxy config');
  return validated.obj;
}

function Editor({ email }: { email: string }) {
  const { t } = useTranslation();
  const bindings = useTgWebProxyBindings();
  const localSnapshot = useTgWebProxySnapshot();
  const { nodes } = useNodesQuery();
  const { bindClient, unbindClient, pending } = useTgWebProxyBindingMutations();

  const binding = bindings.data?.bindings.find(
    (b) => b.email.toLowerCase() === email.toLowerCase(),
  );
  const [draft, setDraft] = useState<{
    profile?: string;
    dedicated?: boolean;
    nodeId?: number | null;
  }>({});

  const nodeId = 'nodeId' in draft ? draft.nodeId : (binding?.nodeId ?? null);
  const profile = 'profile' in draft ? draft.profile : binding?.profileName;
  const dedicated = nodeId != null ? true : (draft.dedicated ?? binding?.dedicated ?? false);

  const remoteSnapshot = useQuery({
    queryKey: [...keys.tgWebProxy.config(), 'remote', nodeId],
    queryFn: () => fetchRemoteSnapshot(nodeId!),
    enabled: nodeId != null && nodeId > 0,
  });

  const snapshot = nodeId == null ? localSnapshot : remoteSnapshot;
  const options = useMemo(
    () =>
      (snapshot.data?.profiles ?? [])
        .filter((p) => !isManagedProfile(p.name))
        .map((p) => ({ value: p.name, label: p.name })),
    [snapshot.data?.profiles],
  );

  const nodeOptions = useMemo(
    () => [
      { value: 0, label: t('pages.tgWebProxy.bindings.local') },
      ...nodes.filter((n) => n.enable).map((n) => ({ value: n.id, label: n.name || `#${n.id}` })),
    ],
    [nodes, t],
  );

  if (nodeId == null && localSnapshot.data && !localSnapshot.data.configExists) {
    return <Alert type="info" showIcon message={t('pages.tgWebProxy.bindings.notConfigured')} />;
  }

  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <Select
        style={{ width: '100%' }}
        value={nodeId ?? 0}
        options={nodeOptions}
        placeholder={t('pages.tgWebProxy.bindings.selectNode')}
        onChange={(value) =>
          setDraft((d) => ({
            ...d,
            nodeId: value === 0 ? null : value,
            profile: undefined,
            dedicated: value === 0 ? d.dedicated : true,
          }))
        }
      />
      <Typography.Text type="secondary">
        {t('pages.tgWebProxy.bindings.remoteHint')}
      </Typography.Text>
      <Select
        allowClear
        style={{ width: '100%' }}
        loading={snapshot.isLoading}
        value={profile}
        options={options}
        placeholder={t('pages.tgWebProxy.bindings.selectProfile')}
        onChange={(value) => setDraft((d) => ({ ...d, profile: value }))}
      />
      {remoteSnapshot.isError && (
        <Alert type="error" showIcon message={(remoteSnapshot.error as Error).message} />
      )}
      <Space align="center">
        <Switch
          checked={dedicated}
          disabled={nodeId != null}
          onChange={(value) => setDraft((d) => ({ ...d, dedicated: value }))}
        />
        <span>{t('pages.tgWebProxy.bindings.dedicated')}</span>
      </Space>
      <Typography.Text type="secondary">
        {t('pages.tgWebProxy.bindings.dedicatedHint')}
      </Typography.Text>
      {binding && (
        <Typography.Text type="secondary">
          {t('pages.tgWebProxy.bindings.effective')}:{' '}
          <Typography.Text code>{binding.effectiveProfile}</Typography.Text>
        </Typography.Text>
      )}
      {binding?.secret && (
        <Typography.Text type="secondary">
          {t('pages.tgWebProxy.bindings.secret')}:{' '}
          <Typography.Text code copyable>
            {binding.secret}
          </Typography.Text>
        </Typography.Text>
      )}
      {binding?.link && (
        <Typography.Text type="secondary">
          {t('pages.tgWebProxy.bindings.link')}:{' '}
          <Typography.Text copyable={{ text: binding.link }} ellipsis style={{ maxWidth: '100%' }}>
            {binding.link}
          </Typography.Text>
        </Typography.Text>
      )}
      {bindings.data?.syncError && (
        <Alert
          type="error"
          showIcon
          message={t('pages.tgWebProxy.bindings.syncError', { error: bindings.data.syncError })}
        />
      )}
      <Space>
        <Button
          type="primary"
          disabled={!profile}
          loading={pending}
          onClick={async () => {
            if (!profile) return;
            await bindClient({
              email,
              profileName: profile,
              dedicated: nodeId != null ? true : dedicated,
              ...(nodeId != null ? { nodeId } : {}),
            });
            setDraft({});
          }}
        >
          {t('pages.tgWebProxy.bindings.bind')}
        </Button>
        {binding && (
          <Button danger loading={pending} onClick={async () => void (await unbindClient(email))}>
            {t('pages.tgWebProxy.bindings.unbind')}
          </Button>
        )}
      </Space>
    </Space>
  );
}

export default function ClientTgWebProxySection({ email }: { email?: string }) {
  const { t } = useTranslation();
  return (
    <div>
      <Typography.Paragraph type="secondary" style={{ marginTop: 4 }}>
        {t('pages.tgWebProxy.bindings.hint')}
      </Typography.Paragraph>
      {email ? (
        <Editor key={email} email={email} />
      ) : (
        <Typography.Text type="secondary">
          {t('pages.tgWebProxy.bindings.saveFirst')}
        </Typography.Text>
      )}
    </div>
  );
}
