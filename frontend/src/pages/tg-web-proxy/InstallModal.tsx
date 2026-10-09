import { useTranslation } from 'react-i18next';
import { Alert, Button, Form, Input, InputNumber, Modal, Radio, Space } from 'antd';

import type { RelayInstallRequest } from '@/generated/types';
import { useTgWebProxyMutations } from '@/api/queries/useTgWebProxy';
import {
  BASE_PATH_PATTERN,
  HOSTNAME_PATTERN,
  SECRET_PATTERN,
  generateSecret,
  isLoopbackHttpUrl,
} from '@/lib/tgWebProxy';

interface InstallFormValues {
  hostname: string;
  email: string;
  secret: string;
  siteKind: 'upstream' | 'dir';
  siteUpstream: string;
  siteDir: string;
  basePathMode: 'none' | 'auto' | 'custom';
  basePath: string;
  mtproxyWorkers: number;
}

export default function InstallModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [form] = Form.useForm<InstallFormValues>();
  const { install, pending } = useTgWebProxyMutations();
  const siteKind = Form.useWatch('siteKind', form);
  const basePathMode = Form.useWatch('basePathMode', form);

  const onOk = async () => {
    const v = await form.validateFields();
    const req: RelayInstallRequest = {
      hostname: v.hostname.trim(),
      email: v.email.trim(),
      secret: v.secret.trim(),
      siteUpstream: v.siteKind === 'upstream' ? v.siteUpstream.trim() : '',
      siteDir: v.siteKind === 'dir' ? v.siteDir.trim() : '',
      basePath: v.basePathMode === 'none' ? 'none' : v.basePathMode === 'auto' ? '' : v.basePath,
      mtproxyWorkers: v.mtproxyWorkers,
    };
    const msg = await install(req);
    if (msg?.success) onClose();
  };

  return (
    <Modal
      open={open}
      title={t('pages.tgWebProxy.install.title')}
      onCancel={onClose}
      onOk={onOk}
      okText={t('install')}
      confirmLoading={pending}
      destroyOnHidden
      width={640}
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message={t('pages.tgWebProxy.install.warning')}
      />
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          siteKind: 'upstream',
          siteUpstream: 'http://127.0.0.1:3000',
          siteDir: '',
          basePathMode: 'auto',
          basePath: '',
          secret: generateSecret(),
          mtproxyWorkers: 1,
        }}
      >
        <Form.Item
          name="hostname"
          label={t('pages.tgWebProxy.hostname')}
          extra={t('pages.tgWebProxy.install.hostnameHint')}
          rules={[
            {
              required: true,
              pattern: HOSTNAME_PATTERN,
              message: t('pages.tgWebProxy.errors.hostname'),
            },
          ]}
        >
          <Input placeholder="proxy.example.com" />
        </Form.Item>
        <Form.Item
          name="email"
          label={t('pages.tgWebProxy.install.email')}
          rules={[{ required: true, type: 'email' }]}
        >
          <Input placeholder="admin@example.com" />
        </Form.Item>
        <Form.Item label={t('pages.tgWebProxy.secret')} required>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item
              name="secret"
              noStyle
              rules={[
                {
                  required: true,
                  pattern: SECRET_PATTERN,
                  message: t('pages.tgWebProxy.errors.secret'),
                },
              ]}
            >
              <Input style={{ fontFamily: 'monospace' }} />
            </Form.Item>
            <Button onClick={() => form.setFieldValue('secret', generateSecret())}>
              {t('regenerate')}
            </Button>
          </Space.Compact>
        </Form.Item>
        <Form.Item name="siteKind" label={t('pages.tgWebProxy.install.site')}>
          <Radio.Group>
            <Radio value="upstream">{t('pages.tgWebProxy.install.siteUpstream')}</Radio>
            <Radio value="dir">{t('pages.tgWebProxy.install.siteDir')}</Radio>
          </Radio.Group>
        </Form.Item>
        {siteKind === 'dir' ? (
          <Form.Item
            name="siteDir"
            label={t('pages.tgWebProxy.install.siteDir')}
            rules={[
              { required: true, pattern: /^\//, message: t('pages.tgWebProxy.errors.absPath') },
            ]}
          >
            <Input placeholder="/root/my-site" />
          </Form.Item>
        ) : (
          <Form.Item
            name="siteUpstream"
            label={t('pages.tgWebProxy.install.siteUpstream')}
            rules={[
              {
                required: true,
                validator: (_, v: string) =>
                  isLoopbackHttpUrl((v || '').trim())
                    ? Promise.resolve()
                    : Promise.reject(new Error(t('pages.tgWebProxy.errors.loopbackUrl'))),
              },
            ]}
          >
            <Input placeholder="http://127.0.0.1:3000" />
          </Form.Item>
        )}
        <Form.Item name="basePathMode" label={t('pages.tgWebProxy.basePath')}>
          <Radio.Group>
            <Radio value="auto">{t('pages.tgWebProxy.install.basePathAuto')}</Radio>
            <Radio value="none">{t('pages.tgWebProxy.install.basePathNone')}</Radio>
            <Radio value="custom">{t('pages.tgWebProxy.install.basePathCustom')}</Radio>
          </Radio.Group>
        </Form.Item>
        {basePathMode === 'custom' && (
          <Form.Item
            name="basePath"
            rules={[
              {
                required: true,
                pattern: BASE_PATH_PATTERN,
                message: t('pages.tgWebProxy.errors.basePath'),
              },
            ]}
          >
            <Input placeholder="phcf2vfe7zgbrslg" />
          </Form.Item>
        )}
        <Form.Item name="mtproxyWorkers" label={t('pages.tgWebProxy.install.workers')}>
          <InputNumber min={1} max={256} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
