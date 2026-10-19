import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Switch, View } from 'react-native';

import { Body, Card, ErrorCard, Muted, Screen } from '@/components/ui';
import { formatBytes } from '@/lib/format';
import { useT } from '@/i18n';
import { useApi } from '@/session';

export default function Inbounds() {
  const api = useApi();
  const t = useT();
  const qc = useQueryClient();
  const inbounds = useQuery({ queryKey: ['inbounds'], queryFn: api.inbounds });
  const toggle = useMutation({
    mutationFn: ({ id, enable }: { id: number; enable: boolean }) => api.setInboundEnabled(id, enable),
    onSettled: () => qc.invalidateQueries({ queryKey: ['inbounds'] }),
  });

  return (
    <Screen refreshing={inbounds.isRefetching} onRefresh={() => void inbounds.refetch()}>
      {inbounds.error && <ErrorCard error={inbounds.error} onRetry={() => void inbounds.refetch()} />}
      {toggle.error && <ErrorCard error={toggle.error} />}
      {inbounds.data?.length === 0 && <Muted>{t('noData')}</Muted>}
      {inbounds.data?.map((ib) => (
        <Card key={ib.id}>
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
            />
          </View>
        </Card>
      ))}
    </Screen>
  );
}
