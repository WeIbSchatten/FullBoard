import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, Table, Tag, Typography } from 'antd';
import { DisconnectOutlined } from '@ant-design/icons';

import type { TgWebProxyBinding } from '@/generated/types';
import { useTgWebProxyBindingMutations, useTgWebProxyBindings } from '@/api/queries/useTgWebProxy';
import type { ModalApi } from './types';

export default function ClientBindingsCard({ modal }: { modal: ModalApi }) {
  const { t } = useTranslation();
  const { data, isLoading } = useTgWebProxyBindings();
  const { unbindClient, pending } = useTgWebProxyBindingMutations();

  const onUnbind = (b: TgWebProxyBinding) =>
    modal.confirm({
      title: t('pages.tgWebProxy.bindings.unbindConfirm', { email: b.email }),
      okText: t('pages.tgWebProxy.bindings.unbind'),
      okType: 'danger',
      cancelText: t('cancel'),
      onOk: async () => {
        await unbindClient(b.email);
      },
    });

  const columns = [
    { title: t('pages.tgWebProxy.bindings.client'), dataIndex: 'email', key: 'email' },
    {
      title: t('pages.tgWebProxy.bindings.profile'),
      dataIndex: 'profileName',
      key: 'profileName',
      render: (name: string) => <Typography.Text code>{name}</Typography.Text>,
    },
    {
      title: t('pages.tgWebProxy.bindings.dedicated'),
      dataIndex: 'dedicated',
      key: 'dedicated',
      render: (dedicated: boolean) =>
        dedicated ? (
          <Tag color="green">{t('pages.tgWebProxy.yes')}</Tag>
        ) : (
          <Tag>{t('pages.tgWebProxy.no')}</Tag>
        ),
    },
    {
      title: t('pages.tgWebProxy.bindings.effective'),
      dataIndex: 'effectiveProfile',
      key: 'effectiveProfile',
      render: (name: string) => <Typography.Text code>{name}</Typography.Text>,
    },
    {
      title: '',
      key: 'actions',
      render: (_: unknown, b: TgWebProxyBinding) => (
        <Button
          size="small"
          danger
          icon={<DisconnectOutlined />}
          loading={pending}
          onClick={() => onUnbind(b)}
        >
          {t('pages.tgWebProxy.bindings.unbind')}
        </Button>
      ),
    },
  ];

  return (
    <Card size="small" style={{ marginTop: 16 }} title={t('pages.tgWebProxy.bindings.title')}>
      <Typography.Paragraph type="secondary">
        {t('pages.tgWebProxy.bindings.hint')}
      </Typography.Paragraph>
      {data?.syncError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message={t('pages.tgWebProxy.bindings.syncError', { error: data.syncError })}
        />
      )}
      <Table
        rowKey="clientId"
        size="small"
        loading={isLoading}
        dataSource={data?.bindings ?? []}
        columns={columns}
        pagination={false}
        scroll={{ x: true }}
        locale={{ emptyText: t('pages.tgWebProxy.bindings.empty') }}
      />
    </Card>
  );
}
