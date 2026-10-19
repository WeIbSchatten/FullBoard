import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, Switch, View } from 'react-native';

import { Chips } from '@/components/Pickers';
import { Badge, Body, Button, Card, ErrorCard, Muted, Screen } from '@/components/ui';
import { useT } from '@/i18n';
import { useApi } from '@/session';
import { usePalette } from '@/theme';

function NodesSection() {
  const api = useApi();
  const t = useT();
  const p = usePalette();
  const router = useRouter();
  const qc = useQueryClient();
  const nodes = useQuery({ queryKey: ['nodes'], queryFn: api.nodes, refetchInterval: 15_000 });
  const toggle = useMutation({
    mutationFn: ({ id, enable }: { id: number; enable: boolean }) => api.setNodeEnabled(id, enable),
    onSettled: () => qc.invalidateQueries({ queryKey: ['nodes'] }),
  });
  return (
    <>
      {nodes.error && <ErrorCard error={nodes.error} onRetry={() => void nodes.refetch()} />}
      {toggle.error && <ErrorCard error={toggle.error} />}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button title={t('pages.nodes.addNode')} kind="primary" onPress={() => router.push('/node/edit')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={t('pages.nodes.addFromInvite')} onPress={() => router.push('/node/enroll')} />
        </View>
      </View>
      {nodes.data?.length === 0 && <Muted>{t('noData')}</Muted>}
      {nodes.data?.map((n) => {
        const online = n.enable && n.status === 'online';
        return (
          <Pressable key={n.id} onPress={() => router.push({ pathname: '/node/[id]', params: { id: String(n.id) } })}>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Body>{n.name}</Body>
                  <Muted>
                    {n.address}:{n.port}
                  </Muted>
                </View>
                <Badge
                  text={
                    !n.enable
                      ? t('disabled')
                      : online
                        ? t('pages.nodes.statusValues.online')
                        : t('pages.nodes.statusValues.offline')
                  }
                  tone={!n.enable ? 'muted' : online ? 'success' : 'error'}
                />
                <Switch
                  value={n.enable}
                  disabled={toggle.isPending}
                  onValueChange={(enable) => toggle.mutate({ id: n.id, enable })}
                  trackColor={{ false: p.surface2, true: p.success }}
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
          </Pressable>
        );
      })}
    </>
  );
}

function HostsSection() {
  const api = useApi();
  const t = useT();
  const p = usePalette();
  const router = useRouter();
  const qc = useQueryClient();
  const groups = useQuery({ queryKey: ['hostGroups'], queryFn: api.hostGroups });
  const toggle = useMutation({
    mutationFn: ({ id, enable }: { id: string; enable: boolean }) => api.setHostGroupEnabled(id, enable),
    onSettled: () => qc.invalidateQueries({ queryKey: ['hostGroups'] }),
  });
  return (
    <>
      {(groups.error || toggle.error) && <ErrorCard error={groups.error ?? toggle.error} />}
      <Button title={t('pages.hosts.addHost')} kind="primary" onPress={() => router.push('/host/edit')} />
      {!groups.data?.length && !groups.isLoading && <Muted>{t('noData')}</Muted>}
      {(groups.data ?? []).map((g) => (
        <Pressable key={g.groupId} onPress={() => router.push({ pathname: '/host/edit', params: { groupId: g.groupId } })}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Body>{g.remark || g.hosts.join(', ')}</Body>
                <Muted numberOfLines={2}>
                  {g.hosts.join(', ')}
                  {g.port ? `:${g.port}` : ''} · {g.security} · {t('menu.inbounds')}: {g.inboundIds.join(', ')}
                </Muted>
              </View>
              <Switch
                value={!g.isDisabled}
                disabled={toggle.isPending}
                onValueChange={(enable) => toggle.mutate({ id: g.groupId, enable })}
                trackColor={{ false: p.surface2, true: p.success }}
              />
            </View>
          </Card>
        </Pressable>
      ))}
    </>
  );
}

export default function NodesAndHosts() {
  const t = useT();
  const qc = useQueryClient();
  const [section, setSection] = useState<'nodes' | 'hosts'>('nodes');
  const [refreshing, setRefreshing] = useState(false);
  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void qc.invalidateQueries().finally(() => setRefreshing(false));
      }}
    >
      <Chips
        options={[
          { value: 'nodes', label: t('menu.nodes') },
          { value: 'hosts', label: t('menu.hosts') },
        ]}
        value={section}
        onChange={setSection}
      />
      {section === 'nodes' ? <NodesSection /> : <HostsSection />}
    </Screen>
  );
}
