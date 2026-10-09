import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Empty, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';

import { keys } from '@/api/queryKeys';
import type { RemoteLiveInbound } from '@/generated/types';
import { HttpUtil } from '@/utils';

interface RemoteLiveInboundsProps {
  nodeId: number;
}

export default function RemoteLiveInbounds({ nodeId }: RemoteLiveInboundsProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [adopting, setAdopting] = useState<string | null>(null);

  const liveQuery = useQuery({
    queryKey: keys.nodes.remoteLive(nodeId),
    enabled: nodeId > 0,
    queryFn: async () => {
      const msg = await HttpUtil.get<RemoteLiveInbound[]>(
        `/panel/api/nodes/remote/${nodeId}/inbounds`,
        undefined,
        { silent: true },
      );
      if (!msg?.success) throw new Error(msg?.msg || t('somethingWentWrong'));
      return Array.isArray(msg.obj) ? msg.obj : [];
    },
  });

  const adopt = async (tag: string) => {
    setAdopting(tag);
    try {
      const msg = await HttpUtil.post(
        `/panel/api/nodes/remote/${nodeId}/adopt`,
        { tag },
        { headers: { 'Content-Type': 'application/json' } },
      );
      if (msg?.success) {
        await queryClient.invalidateQueries({ queryKey: ['nodes', 'remote', nodeId] });
      }
    } finally {
      setAdopting(null);
    }
  };

  const columns: ColumnsType<RemoteLiveInbound> = [
    { title: t('pages.inbounds.remark'), render: (_v, ib) => ib.remark || ib.tag },
    {
      title: t('pages.inbounds.protocol'),
      render: (_v, ib) => (
        <Tag>
          {ib.protocol}:{ib.port}
        </Tag>
      ),
    },
    { title: 'Tag', dataIndex: 'tag' },
    {
      title: t('pages.nodes.actions'),
      render: (_v, ib) =>
        ib.adopted ? (
          <Tag color="green">{t('pages.nodes.remote.adopted')}</Tag>
        ) : (
          <Button
            size="small"
            icon={<PlusOutlined />}
            loading={adopting === ib.tag}
            onClick={() => void adopt(ib.tag)}
          >
            {t('pages.nodes.remote.adopt')}
          </Button>
        ),
    },
  ];

  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <Typography.Title level={5} style={{ margin: 0 }}>
        {t('pages.nodes.remote.liveInbounds')}
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
        {t('pages.nodes.remote.liveInboundsHint')}
      </Typography.Paragraph>
      <Button icon={<ReloadOutlined />} onClick={() => void liveQuery.refetch()}>
        {t('refresh')}
      </Button>
      {liveQuery.error && <Alert type="error" showIcon title={liveQuery.error.message} />}
      <Table<RemoteLiveInbound>
        rowKey="tag"
        size="small"
        loading={liveQuery.isFetching}
        dataSource={liveQuery.data ?? []}
        columns={columns}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <Empty description={t('noData')} /> }}
      />
    </Space>
  );
}
