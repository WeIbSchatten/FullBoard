import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Tooltip, Typography } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';

import type { RelayProfile } from '@/generated/types';
import { OutboundTestResultSchema } from '@/schemas/xray';
import { fetchXrayConfig, type XraySettingsValue } from '@/hooks/useXraySetting';
import {
  resolveProfileEgressOutbound,
  type ProfileEgressInbound,
} from '@/lib/tgWebProxyRouteOutbound';
import { HttpUtil } from '@/utils';
import { getMessage } from '@/utils/messageBus';

function formatEgress(detail: { ipv4?: string; ipv6?: string; country?: string }): string {
  const parts = [detail.ipv4, detail.ipv6, detail.country].filter(Boolean);
  return parts.join(' · ');
}

export default function ProfileEgressCheck({ profile }: { profile: RelayProfile }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [last, setLast] = useState<string>('');

  const run = async () => {
    setLoading(true);
    setLast('');
    try {
      const cfg = await fetchXrayConfig();
      const template = cfg.xraySetting as XraySettingsValue;
      const listMsg = await HttpUtil.get<ProfileEgressInbound[]>(
        '/panel/api/inbounds/list',
        undefined,
        {
          silent: true,
        },
      );
      const inbounds = Array.isArray(listMsg?.obj) ? listMsg.obj : [];
      const tag = resolveProfileEgressOutbound(template, {
        profileName: profile.name,
        backend: profile.backend,
        inbounds,
      });
      if (!tag) {
        const msg = t('pages.tgWebProxy.egress.noRoute');
        setLast(msg);
        getMessage().info(msg);
        return;
      }
      const outbounds = Array.isArray(template.outbounds) ? template.outbounds : [];
      const outbound = outbounds.find(
        (o) => o && typeof o === 'object' && 'tag' in o && String(o.tag) === tag,
      );
      if (!outbound) {
        const msg = t('pages.tgWebProxy.egress.failed', {
          error: t('pages.tgWebProxy.egress.outboundMissing', { tag }),
        });
        setLast(msg);
        getMessage().warning(msg);
        return;
      }
      const raw = await HttpUtil.post('/panel/api/xray/testOutbound', {
        outbound: JSON.stringify(outbound),
        allOutbounds: JSON.stringify(outbounds),
        mode: '',
      });
      if (!raw?.success || !raw.obj) {
        const msg = t('pages.tgWebProxy.egress.failed', {
          error: raw?.msg || t('somethingWentWrong'),
        });
        setLast(msg);
        getMessage().error(msg);
        return;
      }
      const parsed = OutboundTestResultSchema.safeParse(raw.obj);
      if (!parsed.success || !parsed.data.success) {
        const msg = t('pages.tgWebProxy.egress.failed', {
          error: parsed.success
            ? parsed.data.error || t('somethingWentWrong')
            : t('somethingWentWrong'),
        });
        setLast(msg);
        getMessage().error(msg);
        return;
      }
      const egress = parsed.data.egress;
      const detail = egress ? formatEgress(egress) : '';
      if (!detail) {
        const msg = t('pages.tgWebProxy.egress.noIp', { tag });
        setLast(msg);
        getMessage().warning(msg);
        return;
      }
      const msg = t('pages.tgWebProxy.egress.result', { tag, detail });
      setLast(msg);
      getMessage().success(msg);
    } catch (e) {
      const msg = t('pages.tgWebProxy.egress.failed', { error: (e as Error).message });
      setLast(msg);
      getMessage().error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Tooltip title={t('pages.tgWebProxy.egress.hint')}>
        <Button size="small" icon={<GlobalOutlined />} loading={loading} onClick={() => void run()}>
          {t('pages.tgWebProxy.egress.button')}
        </Button>
      </Tooltip>
      {last ? (
        <Typography.Text type="secondary" style={{ display: 'block', maxWidth: 260, marginTop: 4 }}>
          {last}
        </Typography.Text>
      ) : null}
    </div>
  );
}
