import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Badge, Card, Tooltip } from 'antd';

import { useTgWebProxyOverview } from '@/api/queries/useTgWebProxy';
import type { TgWebProxyRelaySummary } from '@/generated/types';

function relayBadge(r: TgWebProxyRelaySummary): 'success' | 'warning' | 'error' {
  if (!r.running) return 'error';
  return r.ready && !r.error ? 'success' : 'warning';
}

// Renders nothing until this panel runs or uses a relay, so most dashboards stay unchanged.
export default function TgWebProxyCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data } = useTgWebProxyOverview();
  if (!data?.length) return null;

  return (
    <Card
      hoverable
      onClick={() => navigate('/connections#tg-web-proxy')}
      styles={{ body: { padding: 0 } }}
    >
      <div className="ov-wide-head">
        <div className="ov-kicker">{t('menu.tgWebProxy')}</div>
      </div>
      <div className="ov-relays">
        {data.map((r) => {
          const state = !r.running
            ? r.error && !r.installed
              ? t('pages.tgWebProxy.unreachable')
              : t('pages.tgWebProxy.backends.stopped')
            : r.ready
              ? t('pages.tgWebProxy.backends.running')
              : t('pages.tgWebProxy.notReady');
          return (
            <div key={r.nodeId} className="ov-relay">
              <div className="ov-relay-name">
                <span className="ov-relay-host">
                  {r.nodeId === 0 ? t('pages.tgWebProxy.bindings.local') : r.name}
                </span>
                <Tooltip title={r.error || undefined}>
                  <Badge status={relayBadge(r)} text={state} />
                </Tooltip>
              </div>
              <div className="ov-relay-meta">
                {r.hostname && <span>{r.hostname}</span>}
                <span>
                  {t('pages.tgWebProxy.profileCount')}: {r.profiles}
                </span>
                <span>
                  {t('clients')}: {r.clients}
                </span>
                {r.backendsTotal > 0 && (
                  <span>
                    MTProxy: {r.backendsActive}/{r.backendsTotal}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
