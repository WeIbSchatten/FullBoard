import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Modal, Space, Typography } from 'antd';
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';

import { HttpUtil } from '@/utils';

const basePath = window.X_UI_BASE_PATH || '';

interface RemoteBackupTabProps {
  nodeId: number;
  onChanged: () => void;
}

export default function RemoteBackupTab({ nodeId, onChanged }: RemoteBackupTabProps) {
  const { t } = useTranslation();
  const [modal, modalContextHolder] = Modal.useModal();
  const fileInput = useRef<HTMLInputElement>(null);
  const [keepHostSettings, setKeepHostSettings] = useState(true);
  const [importing, setImporting] = useState(false);

  const upload = async (file: File) => {
    const form = new FormData();
    form.append('db', file);
    form.append('keepHostSettings', String(keepHostSettings));
    setImporting(true);
    try {
      const msg = await HttpUtil.post(`/panel/api/nodes/remote/${nodeId}/backup/import`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 5 * 60 * 1000,
      });
      if (msg?.success) onChanged();
    } finally {
      setImporting(false);
    }
  };

  const onPicked = (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
    modal.confirm({
      title: t('pages.nodes.remote.importBackupConfirm', { name: file.name }),
      okButtonProps: { danger: true },
      okText: t('pages.index.importDatabase'),
      cancelText: t('cancel'),
      onOk: () => upload(file),
    });
  };

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size="middle">
      {modalContextHolder}
      <div>
        <Typography.Title level={5}>{t('pages.index.exportDatabase')}</Typography.Title>
        <Button
          icon={<DownloadOutlined />}
          href={`${basePath}panel/api/nodes/remote/${nodeId}/backup`}
        >
          {t('pages.index.exportDatabase')}
        </Button>
      </div>
      <div>
        <Typography.Title level={5}>{t('pages.index.importDatabase')}</Typography.Title>
        <Space orientation="vertical">
          <Checkbox
            checked={keepHostSettings}
            onChange={(e) => setKeepHostSettings(e.target.checked)}
          >
            {t('pages.index.importKeepHostSettings')}
          </Checkbox>
          <Typography.Text type="secondary">
            {t('pages.index.importKeepHostSettingsDesc')}
          </Typography.Text>
          <input
            ref={fileInput}
            type="file"
            accept=".db,.dump"
            hidden
            onChange={(e) => onPicked(e.target.files?.[0])}
          />
          <Button
            type="primary"
            icon={<UploadOutlined />}
            loading={importing}
            onClick={() => fileInput.current?.click()}
          >
            {t('pages.index.importDatabase')}
          </Button>
        </Space>
      </div>
    </Space>
  );
}
