import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Switch, View } from 'react-native';

import { Badge, Body, Card, ErrorCard, Muted, Screen } from '@/components/ui';
import { useT } from '@/i18n';
import { useApi } from '@/session';

export default function Nodes() {
  const api = useApi();
  const t = useT();
  const qc = useQueryClient();
  const nodes = useQuery({ queryKey: ['nodes'], queryFn: api.nodes, refetchInterval: 15_000 });
  const toggle = useMutation({
    mutationFn: ({ id, enable }: { id: number; enable: boolean }) => api.setNodeEnabled(id, enable),
    onSettled: () => qc.invalidateQueries({ queryKey: ['nodes'] }),
  });

  return (
    <Screen refreshing={nodes.isRefetching} onRefresh={() => void nodes.refetch()}>
      {nodes.error && <ErrorCard error={nodes.error} onRetry={() => void nodes.refetch()} />}
      {toggle.error && <ErrorCard error={toggle.error} />}
      {nodes.data?.length === 0 && <Muted>{t('noData')}</Muted>}
      {nodes.data?.map((n) => {
        const online = n.enable && n.status === 'online';
        return (
          <Card key={n.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Body>{n.name}</Body>
                <Muted>
                  {n.address}:{n.port}
                </Muted>
              </View>
              <Badge
                text={!n.enable ? t('disabled') : online ? t('pages.nodes.statusValues.online') : t('pages.nodes.statusValues.offline')}
                tone={!n.enable ? 'muted' : online ? 'success' : 'error'}
              />
              <Switch
                value={n.enable}
                disabled={toggle.isPending}
                onValueChange={(enable) => toggle.mutate({ id: n.id, enable })}
              />
            </View>
            {online && (
              <Muted>
                {n.latencyMs} ms · CPU {n.cpuPct.toFixed(0)}% · RAM {n.memPct.toFixed(0)}% · Xray {n.xrayVersion} ·{' '}
                {n.onlineCount}/{n.clientCount}
              </Muted>
            )}
            {!online && !!n.lastError && <Muted numberOfLines={3}>{n.lastError}</Muted>}
          </Card>
        );
      })}
    </Screen>
  );
}
