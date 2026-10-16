import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Empty, Space, Table, Tag, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

import { keys } from '@/api/queryKeys';
import { HttpUtil } from '@/utils';
import { parseMsg } from '@/utils/zodValidate';
import { RelaySnapshotSchema, RelayStatusSchema } from '@/generated/zod';
import type { RelayProfile, RelaySnapshot, RelayStatus } from '@/generated/types';
import { isManagedProfile } from '@/lib/tgWebProxy';

async function fetchRemoteStatus(nodeId: number): Promise<RelayStatus> {
  const msg = await HttpUtil.get(`/panel/api/nodes/remote/${nodeId}/tgWebProxy/status`, undefined, {
    silent: true,
  });
  if (!msg?.success) throw new Error(msg?.msg || 'Failed to fetch remote tg-web-proxy status');
  const validated = parseMsg(msg, RelayStatusSchema, 'nodes/remote/tgWebProxy/status');
  if (!validated.obj) throw new Error('Empty remote tg-web-proxy status');
  return validated.obj;
}

async function fetchRemoteSnapshot(nodeId: number): Promise<RelaySnapshot> {
  const msg = await HttpUtil.get(`/panel/api/nodes/remote/${nodeId}/tgWebProxy/config`, undefined, {
    silent: true,
  });
  if (!msg?.success) throw new Error(msg?.msg || 'Failed to fetch remote tg-web-proxy config');
  const validated = parseMsg(msg, RelaySnapshotSchema, 'nodes/remote/tgWebProxy/config');
  if (!validated.obj) throw new Error('Empty remote tg-web-proxy config');
  return validated.obj;
}

export default function RemoteTgWebProxyTab({ nodeId }: { nodeId: number }) {
  const { t } = useTranslation();
  const statusQuery = useQuery({
    queryKey: ['nodes', 'remote', nodeId, 'tgWebProxy', 'status'],
    queryFn: () => fetchRemoteStatus(nodeId),
    enabled: nodeId > 0,
  });
  const configQuery = useQuery({
    queryKey: [...keys.tgWebProxy.config(), 'remote', nodeId],
    queryFn: () => fetchRemoteSnapshot(nodeId),
    enabled: nodeId > 0,
  });

  const profiles = (configQuery.data?.profiles ?? []).filter((p) => !isManagedProfile(p.name));
  const columns: ColumnsType<RelayProfile> = [
    { title: t('pages.tgWebProxy.profile.name'), dataIndex: 'name' },
    { title: t('pages.tgWebProxy.profile.backend'), dataIndex: 'backend' },
    {
      title: t('pages.tgWebProxy.profile.carrierMode'),
      dataIndex: 'carrierMode',
      render: (v: string | undefined) => v || 'https',
    },
  ];

  const err = (statusQuery.error || configQuery.error) as Error | null;

  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
        {t('pages.nodes.remote.tgWebProxyHint')}
      </Typography.Paragraph>
      <Button
        icon={<ReloadOutlined />}
        onClick={() => {
          void statusQuery.refetch();
          void configQuery.refetch();
        }}
      >
        {t('refresh')}
      </Button>
      {err && <Alert type="error" showIcon title={err.message} />}
      {statusQuery.data && (
        <Space wrap>
          <Tag color={statusQuery.data.supported ? 'green' : 'default'}>
            {statusQuery.data.supported
              ? t('pages.tgWebProxy.installed')
              : t('pages.tgWebProxy.unsupported')}
          </Tag>
          {statusQuery.data.hostname && (
            <Tag>
              {t('pages.tgWebProxy.hostname')}: {statusQuery.data.hostname}
            </Tag>
          )}
          {statusQuery.data.job?.state && (
            <Tag>
              {t('pages.tgWebProxy.job')}: {statusQuery.data.job.state}
            </Tag>
          )}
        </Space>
      )}
      {!configQuery.data?.configExists && !configQuery.isLoading && !err && (
        <Alert type="info" showIcon title={t('pages.tgWebProxy.bindings.notConfigured')} />
      )}
      <Table<RelayProfile>
        rowKey="name"
        size="small"
        loading={configQuery.isFetching}
        dataSource={profiles}
        columns={columns}
        pagination={false}
        locale={{ emptyText: <Empty description={t('noData')} /> }}
      />
    </Space>
  );
}
