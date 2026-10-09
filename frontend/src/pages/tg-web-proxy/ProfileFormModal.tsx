import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Collapse, Form, Input, InputNumber, Modal, Select, Space } from 'antd';

import type { RelayProfile, RelayProfileLimits } from '@/generated/types';
import {
  CARRIER_MODES,
  SECRET_PATTERN,
  generateSecret,
  isLoopbackHostPort,
  nextBackend,
} from '@/lib/tgWebProxy';

const LIMIT_FIELDS: (keyof RelayProfileLimits)[] = [
  'max_sessions',
  'max_streams',
  'max_backend_dials_in_flight',
  'new_sessions_per_minute',
  'new_sessions_burst',
  'new_streams_per_minute',
  'new_streams_burst',
  'max_streams_per_session',
  'max_pending_per_session',
];

interface Props {
  open: boolean;
  profile: RelayProfile | null;
  existing: RelayProfile[];
  saving: boolean;
  onCancel: () => void;
  onSave: (profile: RelayProfile) => void;
}

// Empty limit inputs are dropped so the profile inherits the global ceiling.
function compactLimits(limits: RelayProfileLimits | undefined): RelayProfileLimits | undefined {
  if (!limits) return undefined;
  const entries = Object.entries(limits).filter(([, v]) => typeof v === 'number' && v > 0);
  return entries.length ? (Object.fromEntries(entries) as RelayProfileLimits) : undefined;
}

export default function ProfileFormModal({
  open,
  profile,
  existing,
  saving,
  onCancel,
  onSave,
}: Props) {
  const { t } = useTranslation();
  const [form] = Form.useForm<RelayProfile>();

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(
      profile ?? {
        name: '',
        secret: generateSecret(),
        backend: nextBackend(existing.map((p) => p.backend)),
        carrier_mode: 'https',
      },
    );
  }, [open, profile, existing, form]);

  const onOk = async () => {
    const values = await form.validateFields();
    onSave({
      name: values.name.trim(),
      secret: values.secret.trim().toLowerCase(),
      backend: values.backend.trim(),
      carrier_mode: values.carrier_mode || 'https',
      limits: compactLimits(values.limits ?? undefined),
    });
  };

  const otherNames = existing.filter((p) => p.name !== profile?.name).map((p) => p.name);

  return (
    <Modal
      open={open}
      title={profile ? t('pages.tgWebProxy.profile.edit') : t('pages.tgWebProxy.profile.add')}
      onCancel={onCancel}
      onOk={onOk}
      okText={t('save')}
      confirmLoading={saving}
      width={600}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label={t('pages.tgWebProxy.profile.name')}
          rules={[
            { required: true, max: 64 },
            {
              validator: (_, v: string) =>
                otherNames.includes((v || '').trim())
                  ? Promise.reject(new Error(t('pages.tgWebProxy.errors.duplicateName')))
                  : Promise.resolve(),
            },
          ]}
        >
          <Input />
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
        <Form.Item
          name="backend"
          label={t('pages.tgWebProxy.profile.backend')}
          extra={t('pages.tgWebProxy.profile.backendHint')}
          rules={[
            {
              required: true,
              validator: (_, v: string) =>
                isLoopbackHostPort((v || '').trim())
                  ? Promise.resolve()
                  : Promise.reject(new Error(t('pages.tgWebProxy.errors.loopback'))),
            },
          ]}
        >
          <Input placeholder="127.0.0.1:2398" />
        </Form.Item>
        <Form.Item
          name="carrier_mode"
          label={t('pages.tgWebProxy.profile.carrierMode')}
          extra={t('pages.tgWebProxy.profile.carrierHint')}
        >
          <Select options={CARRIER_MODES.map((m) => ({ value: m, label: m }))} />
        </Form.Item>
        <Collapse
          size="small"
          items={[
            {
              key: 'limits',
              label: t('pages.tgWebProxy.profile.limits'),
              children: (
                <>
                  <p style={{ marginTop: 0 }}>{t('pages.tgWebProxy.profile.limitsHint')}</p>
                  {LIMIT_FIELDS.map((field) => (
                    <Form.Item key={field} name={['limits', field]} label={<code>{field}</code>}>
                      <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                  ))}
                </>
              ),
            },
          ]}
        />
      </Form>
    </Modal>
  );
}
