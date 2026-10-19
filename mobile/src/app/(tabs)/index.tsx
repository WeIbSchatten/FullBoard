import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, View } from 'react-native';

import { Badge, Button, Card, ErrorCard, Meter, Muted, Row, Screen, Title } from '@/components/ui';
import { formatBytes, formatUptime } from '@/lib/format';
import { useT } from '@/i18n';
import { useApi, useSession } from '@/session';

const ratio = (v: { current: number; total: number }) => (v.total ? v.current / v.total : 0);

const XRAY_STATE_KEYS: Record<string, string> = {
  running: 'pages.index.xrayStatusRunning',
  stop: 'pages.index.xrayStatusStop',
  error: 'pages.index.xrayStatusError',
};

function WebProxyCard() {
  const api = useApi();
  const t = useT();
  const relays = useQuery({ queryKey: ['webProxyOverview'], queryFn: api.webProxyOverview, refetchInterval: 30_000 });
  if (!relays.data?.length) return null;
  return (
    <Card>
      <Title>{t('menu.tgWebProxy')}</Title>
      {relays.data.map((r) => (
        <View key={r.nodeId} style={{ gap: 2 }}>
          <Row
            label={r.nodeId === 0 ? t('pages.tgWebProxy.bindings.local') : r.name}
            value={
              <Badge
                text={
                  !r.running
                    ? t(r.installed ? 'pages.tgWebProxy.backends.stopped' : 'pages.tgWebProxy.unreachable')
                    : r.ready
                      ? t('pages.tgWebProxy.backends.running')
                      : t('pages.tgWebProxy.notReady')
                }
                tone={!r.running ? 'error' : r.ready && !r.error ? 'success' : 'warning'}
              />
            }
          />
          <Muted>
            {[r.hostname, `${t('pages.tgWebProxy.profileCount')}: ${r.profiles}`, `${t('clients')}: ${r.clients}`]
              .filter(Boolean)
              .join(' · ')}
          </Muted>
          {!!r.error && <Muted numberOfLines={3}>{r.error}</Muted>}
        </View>
      ))}
    </Card>
  );
}

export default function Overview() {
  const api = useApi();
  const t = useT();
  const { active } = useSession();
  const status = useQuery({ queryKey: ['status'], queryFn: api.status, refetchInterval: 5_000 });
  const restartXray = useMutation({ mutationFn: api.restartXray, onSettled: () => status.refetch() });
  const restartPanel = useMutation({ mutationFn: api.restartPanel });
  const s = status.data;

  return (
    <Screen refreshing={status.isRefetching} onRefresh={() => void status.refetch()}>
      {status.error && <ErrorCard error={status.error} onRetry={() => void status.refetch()} />}
      {s && (
        <>
          <Card>
            <Title>{active?.name}</Title>
            <Row
              label={t('pages.index.xrayStatus')}
              value={
                <Badge
                  text={`${t(XRAY_STATE_KEYS[s.xray.state] ?? 'pages.index.xrayStatusUnknown')} ${s.xray.version}`}
                  tone={s.xray.state === 'running' ? 'success' : 'error'}
                />
              }
            />
            {!!s.xray.errorMsg && <Row label="" value={s.xray.errorMsg} />}
            <Row label="We1ssBoard" value={s.panelVersion} />
            <Row label={t('pages.index.uptime')} value={formatUptime(s.uptime)} />
          </Card>
          <Card>
            <Row label={`${t('pages.index.cpu')} · ${s.cpuCores}`} value={`${s.cpu.toFixed(1)}%`} />
            <Meter ratio={s.cpu / 100} />
            <Row
              label={t('pages.index.memory')}
              value={`${formatBytes(s.mem.current)} / ${formatBytes(s.mem.total)}`}
            />
            <Meter ratio={ratio(s.mem)} />
            <Row
              label={t('pages.index.storage')}
              value={`${formatBytes(s.disk.current)} / ${formatBytes(s.disk.total)}`}
            />
            <Meter ratio={ratio(s.disk)} />
          </Card>
          <Card>
            <Title>{t('pages.index.overallSpeed')}</Title>
            <Row label={t('pages.index.sent')} value={`${formatBytes(s.netTraffic.sent)} · ${formatBytes(s.netIO.up)}/s`} />
            <Row
              label={t('pages.index.received')}
              value={`${formatBytes(s.netTraffic.recv)} · ${formatBytes(s.netIO.down)}/s`}
            />
            <Row label={t('pages.index.connectionCount')} value={`TCP ${s.tcpCount} · UDP ${s.udpCount}`} />
          </Card>
          <WebProxyCard />
        </>
      )}
      <Button
        title={t('pages.nodes.remote.restartXray')}
        busy={restartXray.isPending}
        onPress={() => restartXray.mutate()}
      />
      <Button
        title={t('pages.settings.restartPanel')}
        kind="danger"
        busy={restartPanel.isPending}
        onPress={() =>
          Alert.alert(t('pages.settings.restartPanel'), t('pages.settings.restartPanelDesc'), [
            { text: t('cancel'), style: 'cancel' },
            { text: t('sure'), style: 'destructive', onPress: () => restartPanel.mutate() },
          ])
        }
      />
      {(restartXray.error || restartPanel.error) && <ErrorCard error={restartXray.error ?? restartPanel.error} />}
    </Screen>
  );
}
