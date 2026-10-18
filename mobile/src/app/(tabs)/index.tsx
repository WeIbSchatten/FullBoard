import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { Badge, Button, Card, ErrorCard, Meter, Row, Screen, Title } from '@/components/ui';
import { formatBytes, formatUptime } from '@/lib/format';
import { t } from '@/i18n';
import { useApi } from '@/session';

const ratio = (v: { current: number; total: number }) => (v.total ? v.current / v.total : 0);

export default function Overview() {
  const api = useApi();
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
            <Row
              label={t.overview.xray}
              value={
                <Badge
                  text={`${s.xray.state} ${s.xray.version}`}
                  tone={s.xray.state === 'running' ? 'success' : 'error'}
                />
              }
            />
            {!!s.xray.errorMsg && <Row label="" value={s.xray.errorMsg} />}
            <Row label="We1ssBoard" value={s.panelVersion} />
            <Row label={t.overview.uptime} value={formatUptime(s.uptime)} />
          </Card>
          <Card>
            <Row label={`${t.overview.cpu} · ${s.cpuCores}`} value={`${s.cpu.toFixed(1)}%`} />
            <Meter ratio={s.cpu / 100} />
            <Row label={t.overview.ram} value={`${formatBytes(s.mem.current)} / ${formatBytes(s.mem.total)}`} />
            <Meter ratio={ratio(s.mem)} />
            <Row label={t.overview.disk} value={`${formatBytes(s.disk.current)} / ${formatBytes(s.disk.total)}`} />
            <Meter ratio={ratio(s.disk)} />
          </Card>
          <Card>
            <Title>{t.overview.traffic}</Title>
            <Row label="↑" value={`${formatBytes(s.netTraffic.sent)} · ${formatBytes(s.netIO.up)}/s`} />
            <Row label="↓" value={`${formatBytes(s.netTraffic.recv)} · ${formatBytes(s.netIO.down)}/s`} />
            <Row label={t.overview.connections} value={`TCP ${s.tcpCount} · UDP ${s.udpCount}`} />
          </Card>
        </>
      )}
      <Button
        title={t.overview.restartXray}
        busy={restartXray.isPending}
        onPress={() => restartXray.mutate()}
      />
      <Button
        title={t.overview.restartPanel}
        kind="danger"
        busy={restartPanel.isPending}
        onPress={() =>
          Alert.alert(t.overview.restartPanel, t.overview.restartPanelConfirm, [
            { text: t.common.cancel, style: 'cancel' },
            { text: t.common.ok, style: 'destructive', onPress: () => restartPanel.mutate() },
          ])
        }
      />
      {(restartXray.error || restartPanel.error) && <ErrorCard error={restartXray.error ?? restartPanel.error} />}
    </Screen>
  );
}
