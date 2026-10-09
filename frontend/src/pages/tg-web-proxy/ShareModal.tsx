import { useTranslation } from 'react-i18next';
import { Alert, Button, Descriptions, Modal, QRCode, Space, Typography } from 'antd';
import { CopyOutlined } from '@ant-design/icons';

import type { RelayShareInfo } from '@/generated/types';
import { ClipboardManager } from '@/utils';
import { getMessage } from '@/utils/messageBus';

function CopyValue({ value }: { value: string }) {
  const { t } = useTranslation();
  return (
    <Space size={4} wrap>
      <Typography.Text code style={{ wordBreak: 'break-all' }}>
        {value}
      </Typography.Text>
      <Button
        size="small"
        type="text"
        icon={<CopyOutlined />}
        aria-label={t('copy')}
        onClick={async () => {
          if (await ClipboardManager.copyText(value)) getMessage().success(t('copied'));
        }}
      />
    </Space>
  );
}

export default function ShareModal({
  share,
  onClose,
}: {
  share: RelayShareInfo | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      open={!!share}
      title={t('pages.tgWebProxy.share.title', { name: share?.profile ?? '' })}
      onCancel={onClose}
      footer={null}
      width={560}
    >
      {share && (
        <>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message={t('pages.tgWebProxy.share.hint')}
          />
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label={t('pages.tgWebProxy.share.server')}>
              <CopyValue value={share.server} />
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.tgWebProxy.secret')}>
              <CopyValue value={share.secret} />
            </Descriptions.Item>
            {share.linkSecret !== share.secret && (
              <Descriptions.Item label={t('pages.tgWebProxy.share.linkSecret')}>
                <CopyValue value={share.linkSecret} />
              </Descriptions.Item>
            )}
            <Descriptions.Item label={t('pages.tgWebProxy.share.link')}>
              <CopyValue value={share.link} />
            </Descriptions.Item>
            <Descriptions.Item label="tg://">
              <CopyValue value={share.deepLink} />
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.tgWebProxy.profile.carrierMode')}>
              {share.carrierMode}
            </Descriptions.Item>
          </Descriptions>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <QRCode value={share.link} size={200} />
          </div>
        </>
      )}
    </Modal>
  );
}
