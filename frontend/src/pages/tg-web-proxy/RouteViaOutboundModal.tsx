import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Form, InputNumber, Modal, Select, Space, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';

import type { RelayProfile } from '@/generated/types';
import { fetchXrayConfig } from '@/hooks/useXraySetting';
import type { XraySettingsValue } from '@/hooks/useXraySetting';
import { HttpUtil } from '@/utils';
import { getMessage } from '@/utils/messageBus';
import {
  applyTproxyBackendRule,
  buildTproxyBackendRule,
  buildTproxyTunnelInbound,
  loopbackBackend,
  parseBackendHostPort,
  pickLoopbackListenPort,
} from '@/lib/tgWebProxyRouteOutbound';

interface Props {
  profile: RelayProfile | null;
  open: boolean;
  onClose: () => void;
  onApplied: (profile: RelayProfile) => Promise<void>;
}

interface RouteSources {
  tags: string[];
  usedPorts: number[];
  suggestedPort: number;
}

async function loadRouteSources(): Promise<RouteSources> {
  const cfg = await fetchXrayConfig();
  const template = cfg.xraySetting as XraySettingsValue;
  const outbounds = Array.isArray(template.outbounds) ? template.outbounds : [];
  const tags = outbounds
    .map((o) => (o && typeof o === 'object' && 'tag' in o ? String(o.tag) : ''))
    .filter(Boolean);
  const ports: number[] = [];
  const listMsg = await HttpUtil.get<{ port?: number }[]>('/panel/api/inbounds/list', undefined, {
    silent: true,
  });
  if (Array.isArray(listMsg?.obj)) {
    for (const ib of listMsg.obj) {
      if (typeof ib.port === 'number') ports.push(ib.port);
    }
  }
  return { tags, usedPorts: ports, suggestedPort: pickLoopbackListenPort(ports) };
}

export default function RouteViaOutboundModal({ profile, open, onClose, onApplied }: Props) {
  const { t } = useTranslation();
  const [outboundTag, setOutboundTag] = useState<string>();
  const [listenPortOverride, setListenPortOverride] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const sourcesQuery = useQuery({
    queryKey: ['tgWebProxy', 'routeViaSources', profile?.name ?? ''],
    queryFn: loadRouteSources,
    enabled: open && !!profile,
  });

  const rewrite = useMemo(
    () => (profile ? parseBackendHostPort(profile.backend) : null),
    [profile],
  );
  const listenPort = listenPortOverride ?? sourcesQuery.data?.suggestedPort;
  const tags = sourcesQuery.data?.tags ?? [];
  const usedPorts = sourcesQuery.data?.usedPorts ?? [];
  const loading = sourcesQuery.isFetching;

  const submit = async () => {
    if (!profile || !rewrite || !outboundTag || !listenPort) return;
    setSaving(true);
    try {
      const inbound = buildTproxyTunnelInbound({
        profileName: profile.name,
        listenPort,
        rewrite,
      });
      const addMsg = await HttpUtil.post('/panel/api/inbounds/add', inbound, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!addMsg?.success) {
        getMessage().error(addMsg?.msg || t('pages.tgWebProxy.routeVia.failed'));
        return;
      }

      const cfg = await fetchXrayConfig();
      const template = structuredClone(cfg.xraySetting) as XraySettingsValue;
      const rule = buildTproxyBackendRule(inbound.tag, outboundTag);
      if (!rule) {
        getMessage().error(t('pages.tgWebProxy.routeVia.failed'));
        return;
      }
      applyTproxyBackendRule(template, rule, 'top');
      const updateMsg = await HttpUtil.post('/panel/api/xray/update', {
        xraySetting: JSON.stringify(template),
      });
      if (!updateMsg?.success) {
        getMessage().error(updateMsg?.msg || t('pages.tgWebProxy.routeVia.failed'));
        return;
      }

      await onApplied({ ...profile, backend: loopbackBackend(listenPort) });
      getMessage().success(t('pages.tgWebProxy.routeVia.done'));
      onClose();
    } catch (e) {
      getMessage().error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('pages.tgWebProxy.routeVia.title', { name: profile?.name ?? '' })}
      onCancel={onClose}
      onOk={submit}
      okText={t('pages.tgWebProxy.routeVia.apply')}
      confirmLoading={saving}
      okButtonProps={{ disabled: !rewrite || !outboundTag || !listenPort || loading }}
      afterOpenChange={(isOpen) => {
        if (!isOpen) {
          setOutboundTag(undefined);
          setListenPortOverride(null);
        }
      }}
      destroyOnHidden
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Alert type="warning" showIcon message={t('pages.tgWebProxy.routeVia.warning')} />
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {t('pages.tgWebProxy.routeVia.hint')}
        </Typography.Paragraph>
        <Form layout="vertical">
          <Form.Item label={t('pages.tgWebProxy.profile.backend')}>
            <Typography.Text code>{profile?.backend}</Typography.Text>
          </Form.Item>
          <Form.Item label={t('pages.tgWebProxy.routeVia.outbound')} required>
            <Select
              showSearch
              loading={loading}
              value={outboundTag}
              onChange={setOutboundTag}
              options={tags.map((tag) => ({ value: tag, label: tag }))}
              placeholder={t('pages.tgWebProxy.routeVia.outboundPlaceholder')}
            />
          </Form.Item>
          <Form.Item label={t('pages.tgWebProxy.routeVia.listenPort')} required>
            <InputNumber
              min={1}
              max={65535}
              style={{ width: '100%' }}
              value={listenPort}
              onChange={(v) => setListenPortOverride(typeof v === 'number' ? v : null)}
            />
          </Form.Item>
          {listenPort ? (
            <Typography.Text type="secondary">
              {t('pages.tgWebProxy.routeVia.resultBackend')}:{' '}
              <Typography.Text code>{loopbackBackend(listenPort)}</Typography.Text>
            </Typography.Text>
          ) : null}
          {usedPorts.includes(listenPort ?? -1) ? (
            <Alert type="error" showIcon message={t('pages.tgWebProxy.routeVia.portInUse')} />
          ) : null}
        </Form>
      </Space>
    </Modal>
  );
}
