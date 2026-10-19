import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, Switch, View } from 'react-native';

import { Body, Button, Card, ErrorCard, Muted } from '@/components/ui';
import { formatBytes } from '@/lib/format';
import { useT } from '@/i18n';
import { useApi } from '@/session';
import { usePalette } from '@/theme';

export function InboundsSection() {
  const api = useApi();
  const t = useT();
  const p = usePalette();
  const qc = useQueryClient();
  const router = useRouter();
  const inbounds = useQuery({ queryKey: ['inbounds'], queryFn: api.inbounds });
  const toggle = useMutation({
    mutationFn: ({ id, enable }: { id: number; enable: boolean }) => api.setInboundEnabled(id, enable),
    onSettled: () => qc.invalidateQueries({ queryKey: ['inbounds'] }),
  });

  return (
    <>
      {inbounds.error && <ErrorCard error={inbounds.error} onRetry={() => void inbounds.refetch()} />}
      <Button title={t('pages.inbounds.addInbound')} kind="primary" onPress={() => router.push('/inbound/edit')} />
      {toggle.error && <ErrorCard error={toggle.error} />}
      {inbounds.data?.length === 0 && <Muted>{t('noData')}</Muted>}
      {inbounds.data?.map((ib) => (
        <Pressable key={ib.id} onPress={() => router.push({ pathname: '/inbound/[id]', params: { id: String(ib.id) } })}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Body>{ib.remark || ib.tag}</Body>
                <Muted>
                  {ib.protocol} · {ib.port} · {t('clients')}: {ib.clientStats?.length ?? 0}
                </Muted>
                <Muted>
                  ↑ {formatBytes(ib.up)} ↓ {formatBytes(ib.down)}
                </Muted>
              </View>
              <Switch
                value={ib.enable}
                disabled={toggle.isPending}
                onValueChange={(enable) => toggle.mutate({ id: ib.id, enable })}
                trackColor={{ false: p.surface2, true: p.success }}
              />
            </View>
          </Card>
        </Pressable>
      ))}
    </>
  );
}
