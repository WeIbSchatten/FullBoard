import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Space,
  Switch,
} from 'antd';

import type {
  RelayConfig,
  RelayLimits,
  RelayProfile,
  RelaySnapshot,
  RelayTimeouts,
} from '@/generated/types';
import { useTgWebProxyMutations } from '@/api/queries/useTgWebProxy';
import {
  BASE_PATH_PATTERN,
  CARRIER_MODES,
  HOSTNAME_PATTERN,
  SECRET_PATTERN,
  generateSecret,
  isLoopbackHostPort,
  isLoopbackHttpUrl,
} from '@/lib/tgWebProxy';
import { reportApply } from './ProfilesTab';

type SiteKind = 'upstream' | 'dir';

interface ConfigFormValues extends RelayConfig {
  siteKind: SiteKind;
  initialProfile?: RelayProfile;
}

const LIMIT_FIELDS: (keyof RelayLimits)[] = [
  'max_sessions_global',
  'max_streams_global',
  'max_backend_dials_in_flight',
  'max_sessions_per_ip',
  'max_bootstraps_per_ip',
  'new_sessions_per_minute',
  'new_sessions_burst',
  'new_streams_per_minute',
  'new_streams_burst',
  'max_bootstraps_global',
  'new_bootstraps_per_minute',
  'new_bootstraps_burst',
  'max_streams_per_session',
  'max_pending_per_session',
  'max_pending_global',
  'max_pending_items_per_session',
  'max_pending_items_global',
  'max_closed_stream_ids',
  'max_header_bytes',
  'max_body_bytes',
  'max_frame_payload',
  'carrier_batch_bytes',
  'max_profiles',
];

const TIMEOUT_FIELDS: (keyof RelayTimeouts)[] = [
  'backend_dial',
  'long_poll',
  'reconnect_grace',
  'bootstrap_lifetime',
  'read_header',
  'idle',
  'shutdown',
];

const DURATION_PATTERN = /^(\d+(\.\d+)?(ns|us|µs|ms|s|m|h))+$/;

export default function ConfigTab({ snapshot }: { snapshot: RelaySnapshot }) {
  const { t } = useTranslation();
  const [form] = Form.useForm<ConfigFormValues>();
  const { saveConfig, pending } = useTgWebProxyMutations();
  const siteKind = Form.useWatch('siteKind', form);
  const [dirty, setDirty] = useState(false);
  const needsInitialProfile = snapshot.profiles.length === 0;
  const [initialValues] = useState<ConfigFormValues>(() => ({
    ...snapshot.config,
    siteKind: snapshot.config.public_dir ? 'dir' : 'upstream',
    initialProfile: {
      name: 'default',
      secret: generateSecret(),
      backend: '127.0.0.1:2398',
      carrier_mode: 'https',
    },
  }));

  const loopbackRule = {
    validator: (_: unknown, v: string) =>
      isLoopbackHostPort((v || '').trim())
        ? Promise.resolve()
        : Promise.reject(new Error(t('pages.tgWebProxy.errors.loopback'))),
  };

  const onSave = async () => {
    const values = await form.validateFields();
    const { siteKind: kind, initialProfile, ...rest } = values;
    const config: RelayConfig = {
      ...snapshot.config,
      ...rest,
      limits: { ...snapshot.config.limits, ...rest.limits },
      timeouts: { ...snapshot.config.timeouts, ...rest.timeouts },
      public_dir: kind === 'dir' ? rest.public_dir.trim() : '',
      public_upstream: kind === 'upstream' ? rest.public_upstream.trim() : '',
    };
    const msg = await saveConfig({
      config,
      initialProfile: needsInitialProfile ? initialProfile : undefined,
    });
    if (msg?.success) {
      setDirty(false);
      reportApply(msg, t);
    }
  };

  return (
    <Card
      size="small"
      title={t('pages.tgWebProxy.tabs.config')}
      extra={
        <Button type="primary" size="small" loading={pending} disabled={!dirty} onClick={onSave}>
          {t('save')}
        </Button>
      }
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={t('pages.tgWebProxy.config.applyHint')}
      />
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        onValuesChange={() => setDirty(true)}
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="public_hostname"
              label={t('pages.tgWebProxy.hostname')}
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
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="base_path"
              label={t('pages.tgWebProxy.basePath')}
              extra={t('pages.tgWebProxy.config.basePathHint')}
              rules={[
                { pattern: BASE_PATH_PATTERN, message: t('pages.tgWebProxy.errors.basePath') },
              ]}
            >
              <Input placeholder="phcf2vfe7zgbrslg" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="listen"
              label={t('pages.tgWebProxy.config.listen')}
              rules={[loopbackRule]}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="admin_listen"
              label={t('pages.tgWebProxy.adminListen')}
              extra={t('pages.tgWebProxy.config.adminHint')}
              rules={[loopbackRule]}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="siteKind" label={t('pages.tgWebProxy.install.site')}>
              <Radio.Group>
                <Radio value="upstream">{t('pages.tgWebProxy.install.siteUpstream')}</Radio>
                <Radio value="dir">{t('pages.tgWebProxy.install.siteDir')}</Radio>
              </Radio.Group>
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            {siteKind === 'dir' ? (
              <Form.Item
                name="public_dir"
                label="public_dir"
                rules={[
                  { required: true, pattern: /^\//, message: t('pages.tgWebProxy.errors.absPath') },
                ]}
              >
                <Input placeholder="/srv/tproxy-site" />
              </Form.Item>
            ) : (
              <Form.Item
                name="public_upstream"
                label="public_upstream"
                rules={[
                  {
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
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="static_routes" label="static_routes">
              <Select options={[{ value: 'exact' }, { value: 'legacy' }]} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="token_key_file" label="token_key_file" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="profiles_file"
              label="profiles_file"
              extra={t('pages.tgWebProxy.config.profilesFileHint')}
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              name="enable_pprof"
              label="enable_pprof"
              valuePropName="checked"
              extra={t('pages.tgWebProxy.config.pprofHint')}
            >
              <Switch />
            </Form.Item>
          </Col>
        </Row>

        {needsInitialProfile && (
          <Card
            size="small"
            type="inner"
            title={t('pages.tgWebProxy.config.initialProfile')}
            style={{ marginBottom: 16 }}
          >
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name={['initialProfile', 'name']}
                  label={t('pages.tgWebProxy.profile.name')}
                  rules={[{ required: true, max: 64 }]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={t('pages.tgWebProxy.secret')} required>
                  <Space.Compact style={{ width: '100%' }}>
                    <Form.Item
                      name={['initialProfile', 'secret']}
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
                    <Button
                      onClick={() =>
                        form.setFieldValue(['initialProfile', 'secret'], generateSecret())
                      }
                    >
                      {t('regenerate')}
                    </Button>
                  </Space.Compact>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name={['initialProfile', 'backend']}
                  label={t('pages.tgWebProxy.profile.backend')}
                  rules={[loopbackRule]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name={['initialProfile', 'carrier_mode']}
                  label={t('pages.tgWebProxy.profile.carrierMode')}
                >
                  <Select options={CARRIER_MODES.map((m) => ({ value: m, label: m }))} />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        )}

        <Collapse
          size="small"
          items={[
            {
              key: 'limits',
              label: t('pages.tgWebProxy.config.limits'),
              forceRender: true,
              children: (
                <Row gutter={16}>
                  {LIMIT_FIELDS.map((field) => (
                    <Col xs={24} md={12} lg={8} key={field}>
                      <Form.Item
                        name={['limits', field]}
                        label={<code>{field}</code>}
                        rules={[{ required: true }]}
                      >
                        <InputNumber min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  ))}
                </Row>
              ),
            },
            {
              key: 'timeouts',
              label: t('pages.tgWebProxy.config.timeouts'),
              forceRender: true,
              children: (
                <Row gutter={16}>
                  {TIMEOUT_FIELDS.map((field) => (
                    <Col xs={24} md={12} lg={8} key={field}>
                      <Form.Item
                        name={['timeouts', field]}
                        label={<code>{field}</code>}
                        rules={[
                          {
                            required: true,
                            pattern: DURATION_PATTERN,
                            message: t('pages.tgWebProxy.errors.duration'),
                          },
                        ]}
                      >
                        <Input />
                      </Form.Item>
                    </Col>
                  ))}
                </Row>
              ),
            },
          ]}
        />
      </Form>
    </Card>
  );
}
