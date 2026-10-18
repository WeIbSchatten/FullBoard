import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Select, Space, Switch, Typography } from 'antd';

import { useClientOptions } from '@/api/queries/useClientOptions';
import { useTgWebProxyBindingMutations } from '@/api/queries/useTgWebProxy';

interface Props {
  open: boolean;
  profileName: string;
  // Set for a node's relay; such bindings are always dedicated.
  nodeId?: number;
  onClose: () => void;
}

// Mount it only while open so each opening starts with an empty selection.
export default function BindClientsModal({ open, profileName, nodeId, onClose }: Props) {
  const { t } = useTranslation();
  const clients = useClientOptions(open);
  const { bindClients, pending } = useTgWebProxyBindingMutations();
  const [emails, setEmails] = useState<string[]>([]);
  const [dedicated, setDedicated] = useState(true);
  const remote = nodeId != null;

  const onOk = async () => {
    const msg = await bindClients({
      emails,
      profileName,
      dedicated: remote || dedicated,
      ...(remote ? { nodeId } : {}),
    });
    if (msg?.success) onClose();
  };

  return (
    <Modal
      open={open}
      title={t('pages.tgWebProxy.bindings.addToSubsTitle', { name: profileName })}
      okText={t('add')}
      okButtonProps={{ disabled: emails.length === 0, loading: pending }}
      onOk={() => void onOk()}
      onCancel={onClose}
      destroyOnHidden
    >
      <Space orientation="vertical" style={{ width: '100%' }}>
        <Typography.Text type="secondary">
          {t('pages.tgWebProxy.bindings.addToSubsHint')}
        </Typography.Text>
        <Select
          mode="multiple"
          allowClear
          style={{ width: '100%' }}
          loading={clients.isLoading}
          value={emails}
          onChange={setEmails}
          placeholder={t('pages.tgWebProxy.bindings.selectClients')}
          options={(clients.data ?? []).map((email) => ({ value: email, label: email }))}
        />
        <Space align="center">
          <Switch checked={remote || dedicated} disabled={remote} onChange={setDedicated} />
          <span>{t('pages.tgWebProxy.bindings.dedicated')}</span>
        </Space>
        <Typography.Text type="secondary">
          {remote
            ? t('pages.tgWebProxy.bindings.remoteHint')
            : t('pages.tgWebProxy.bindings.dedicatedHint')}
        </Typography.Text>
      </Space>
    </Modal>
  );
}
