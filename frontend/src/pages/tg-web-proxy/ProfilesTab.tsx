import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, Space, Table, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, ShareAltOutlined } from '@ant-design/icons';

import type {
  RelayApplyResult,
  RelayProfile,
  RelayShareInfo,
  RelaySnapshot,
} from '@/generated/types';
import { fetchShare, useTgWebProxyMutations } from '@/api/queries/useTgWebProxy';
import type { Msg } from '@/utils';
import { getMessage } from '@/utils/messageBus';
import ProfileFormModal from './ProfileFormModal';
import ShareModal from './ShareModal';
import type { ModalApi } from './types';

function maskSecret(secret: string): string {
  return secret.length > 8 ? `${secret.slice(0, 4)}…${secret.slice(-4)}` : '••••';
}

export function reportApply(
  msg: Msg<RelayApplyResult> | undefined,
  t: (key: string, opts?: Record<string, unknown>) => string,
) {
  const res = msg?.obj;
  if (!msg?.success || !res) return;
  if (res.restartError) {
    getMessage().warning(t('pages.tgWebProxy.toasts.restartFailed', { error: res.restartError }));
  } else if (res.restarted) {
    getMessage().info(t('pages.tgWebProxy.toasts.restarted'));
  }
}

export default function ProfilesTab({
  snapshot,
  loading,
  modal,
}: {
  snapshot: RelaySnapshot | undefined;
  loading: boolean;
  modal: ModalApi;
}) {
  const { t } = useTranslation();
  const { addProfile, updateProfile, deleteProfile, pending } = useTgWebProxyMutations();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RelayProfile | null>(null);
  const [share, setShare] = useState<RelayShareInfo | null>(null);
  const profiles = snapshot?.profiles ?? [];

  const onSave = async (profile: RelayProfile) => {
    const msg = editing ? await updateProfile(editing.name, profile) : await addProfile(profile);
    if (msg?.success) {
      setFormOpen(false);
      reportApply(msg, t);
    }
  };

  const onDelete = (p: RelayProfile) =>
    modal.confirm({
      title: t('pages.tgWebProxy.profile.deleteConfirm', { name: p.name }),
      okText: t('delete'),
      okType: 'danger',
      cancelText: t('cancel'),
      onOk: async () => reportApply(await deleteProfile(p.name), t),
    });

  const columns = [
    { title: t('pages.tgWebProxy.profile.name'), dataIndex: 'name', key: 'name' },
    {
      title: t('pages.tgWebProxy.secret'),
      dataIndex: 'secret',
      key: 'secret',
      render: (s: string) => <Typography.Text code>{maskSecret(s)}</Typography.Text>,
    },
    {
      title: t('pages.tgWebProxy.profile.backend'),
      dataIndex: 'backend',
      key: 'backend',
      render: (b: string) => <Typography.Text code>{b}</Typography.Text>,
    },
    {
      title: t('pages.tgWebProxy.profile.carrierMode'),
      dataIndex: 'carrier_mode',
      key: 'carrier_mode',
      render: (m: string | undefined) => <Tag>{m || 'https'}</Tag>,
    },
    {
      title: t('pages.tgWebProxy.profile.limits'),
      key: 'limits',
      render: (_: unknown, p: RelayProfile) =>
        p.limits ? <Tag color="blue">{Object.keys(p.limits).length}</Tag> : '-',
    },
    {
      title: '',
      key: 'actions',
      render: (_: unknown, p: RelayProfile) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<ShareAltOutlined />}
            onClick={async () => setShare(await fetchShare(p.name))}
          >
            {t('pages.tgWebProxy.share.button')}
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            aria-label={t('edit')}
            onClick={() => {
              setEditing(p);
              setFormOpen(true);
            }}
          />
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            aria-label={t('delete')}
            disabled={profiles.length <= 1}
            onClick={() => onDelete(p)}
          />
        </Space>
      ),
    },
  ];

  return (
    <Card
      size="small"
      title={t('pages.tgWebProxy.tabs.profiles')}
      extra={
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          disabled={!snapshot?.configExists}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          {t('add')}
        </Button>
      }
    >
      {!snapshot?.configExists && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={t('pages.tgWebProxy.profile.needConfig')}
        />
      )}
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message={t('pages.tgWebProxy.profile.backendWarning')}
      />
      <Table
        rowKey="name"
        size="small"
        loading={loading}
        dataSource={profiles}
        columns={columns}
        pagination={false}
        scroll={{ x: true }}
      />
      <ProfileFormModal
        open={formOpen}
        profile={editing}
        existing={profiles}
        saving={pending}
        onCancel={() => setFormOpen(false)}
        onSave={onSave}
      />
      <ShareModal share={share} onClose={() => setShare(null)} />
    </Card>
  );
}
