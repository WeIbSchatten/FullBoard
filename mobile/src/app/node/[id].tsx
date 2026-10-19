import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Linking, Text, View } from 'react-native';

import { Chips } from '@/components/Pickers';
import { Badge, Button, Card, ErrorCard, Loading, Muted, Row, Screen, Title } from '@/components/ui';
import { formatBytes, formatUptime } from '@/lib/format';
import { useT } from '@/i18n';
import { RequireSession, useApi } from '@/session';
import { usePalette } from '@/theme';

function LogsCard({ id }: { id: number }) {
  const api = useApi();
  const t = useT();
  const p = usePalette();
  const [source, setSource] = useState<'panel' | 'xray'>('panel');
  const logs = useQuery({ queryKey: ['node', id, 'logs', source], queryFn: () => api.remoteLogs(id, source), enabled: false });
  const lines = Array.isArray(logs.data) ? logs.data : typeof logs.data === 'string' ? logs.data.split('\n') : [];
  return (
    <Card>
      <Title>{t('pages.index.logs')}</Title>
      <Chips
        options={[
          { value: 'panel', label: 'We1ssBoard' },
          { value: 'xray', label: 'Xray' },
        ]}
        value={source}
        onChange={setSource}
      />
      <Button title={t('refresh')} busy={logs.isFetching} onPress={() => void logs.refetch()} />
      {logs.error && <ErrorCard error={logs.error} />}
      {!!lines.length && (
        <Text selectable style={{ color: p.text2, fontFamily: 'monospace', fontSize: 11 }}>
          {lines.slice(-200).join('\n')}
        </Text>
      )}
    </Card>
  );
}

function NodeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const nodeId = Number(id);
  const api = useApi();
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const node = useQuery({ queryKey: ['node', nodeId], queryFn: () => api.node(nodeId), refetchInterval: 15_000 });
  const remote = useQuery({ queryKey: ['node', nodeId, 'status'], queryFn: () => api.remoteStatus(nodeId) });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['node', nodeId] });
    void qc.invalidateQueries({ queryKey: ['nodes'] });
  };
  const act = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), onSettled: refresh });
  const login = useMutation({
    mutationFn: () => api.remoteLoginUrl(nodeId),
    onSuccess: (r) => void Linking.openURL(typeof r === 'string' ? r : r.url),
  });
  const remove = useMutation({
    mutationFn: () => api.deleteNode(nodeId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['nodes'] });
      router.back();
    },
  });

  if (node.isLoading) return <Loading />;
  const n = node.data;
  const rs = remote.data;
  const online = !!n?.enable && n.status === 'online';
  const confirm = (title: string, body: string, fn: () => Promise<unknown>) =>
    Alert.alert(title, body, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('sure'), style: 'destructive', onPress: () => act.mutate(fn) },
    ]);

  return (
    <Screen refreshing={node.isRefetching} onRefresh={refresh}>
      <Stack.Screen options={{ title: n?.name ?? '' }} />
      {(node.error || act.error || login.error || remove.error) && (
        <ErrorCard error={node.error ?? act.error ?? login.error ?? remove.error} />
      )}
      {n && (
        <>
          <Card>
            <Row
              label={t('pages.nodes.status')}
              value={
                <Badge
                  text={online ? t('pages.nodes.statusValues.online') : t('pages.nodes.statusValues.offline')}
                  tone={online ? 'success' : 'error'}
                />
              }
            />
            <Row label={t('pages.nodes.address')} value={`${n.scheme}://${n.address}:${n.port}${n.basePath}`} />
            <Row label={t('pages.nodes.latency')} value={`${n.latencyMs} ms`} />
            <Row label={t('pages.nodes.panelVersion')} value={n.panelVersion || '—'} />
            <Row label={t('pages.nodes.xrayVersion')} value={n.xrayVersion || '—'} />
            <Row label={t('pages.nodes.uptime')} value={formatUptime(n.uptimeSecs)} />
            <Row label={t('clients')} value={`${n.onlineCount} / ${n.clientCount}`} />
            {!!n.lastError && <Muted>{n.lastError}</Muted>}
          </Card>
          {rs && (
            <Card>
              <Title>{t('pages.nodes.remote.overview')}</Title>
              <Row label={t('pages.index.cpu')} value={`${rs.cpu.toFixed(1)}%`} />
              <Row label={t('pages.index.memory')} value={`${formatBytes(rs.mem.current)} / ${formatBytes(rs.mem.total)}`} />
              <Row label={t('pages.index.storage')} value={`${formatBytes(rs.disk.current)} / ${formatBytes(rs.disk.total)}`} />
              <Row label="Xray" value={`${rs.xray.state} ${rs.xray.version}`} />
            </Card>
          )}
          {remote.error && <Muted>{t('pages.nodes.remote.manageHint')}</Muted>}
          <View style={{ gap: 8 }}>
            <Button title={t('pages.nodes.probe')} busy={act.isPending} onPress={() => act.mutate(() => api.probeNode(nodeId))} />
            <Button title={t('pages.nodes.remote.loginAs')} busy={login.isPending} onPress={() => login.mutate()} />
            <Button
              title={t('pages.nodes.remote.restartXray')}
              onPress={() => act.mutate(() => api.remoteRestartXray(nodeId))}
            />
            <Button
              title={`${t('pages.index.stopXray')} Xray`}
              onPress={() => confirm(t('pages.index.stopXray'), t('pages.nodes.remote.stopXrayConfirm'), () => api.remoteStopXray(nodeId))}
            />
            <Button
              title={t('pages.nodes.remote.restartPanel')}
              onPress={() =>
                confirm(t('pages.nodes.remote.restartPanelConfirm', { name: n.name }), t('pages.nodes.remote.restartPanelDesc'), () =>
                  api.remoteRestartPanel(nodeId),
                )
              }
            />
          </View>
          <LogsCard id={nodeId} />
          <Button
            title={t('pages.nodes.editNode')}
            kind="primary"
            onPress={() => router.push({ pathname: '/node/edit', params: { id: String(nodeId) } })}
          />
          <Button
            title={t('delete')}
            kind="danger"
            busy={remove.isPending}
            onPress={() =>
              Alert.alert(t('pages.nodes.deleteConfirmTitle', { name: n.name }), t('pages.nodes.deleteConfirmContent'), [
                { text: t('cancel'), style: 'cancel' },
                { text: t('delete'), style: 'destructive', onPress: () => remove.mutate() },
              ])
            }
          />
        </>
      )}
    </Screen>
  );
}

export default function NodeRoute() {
  return (
    <RequireSession>
      <NodeScreen />
    </RequireSession>
  );
}
