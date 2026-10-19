import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, View } from 'react-native';

import { Body, Button, Card, ErrorCard, Muted, Title } from '@/components/ui';
import { useT } from '@/i18n';
import { useApi } from '@/session';

export function IpLogCard({ email }: { email: string }) {
  const api = useApi();
  const t = useT();
  const qc = useQueryClient();
  const ips = useQuery({ queryKey: ['client', email, 'ips'], queryFn: () => api.clientIps(email) });
  const clear = useMutation({
    mutationFn: () => api.clearClientIps(email),
    onSettled: () => qc.invalidateQueries({ queryKey: ['client', email, 'ips'] }),
  });
  const list = ips.data ?? [];
  return (
    <Card>
      <Title>{t('pages.clients.ipLog')}</Title>
      {ips.error && <ErrorCard error={ips.error} />}
      {!list.length && !ips.isLoading && <Muted>{t('noData')}</Muted>}
      {list.map((row) => (
        <View key={`${row.ip}-${row.node}`}>
          <Body selectable>{row.ip}</Body>
          <Muted>{[row.time, row.node].filter(Boolean).join(' · ')}</Muted>
        </View>
      ))}
      {!!list.length && <Button title={t('clear')} busy={clear.isPending} onPress={() => clear.mutate()} />}
    </Card>
  );
}

export function HwidCard({ email }: { email: string }) {
  const api = useApi();
  const t = useT();
  const qc = useQueryClient();
  const key = ['client', email, 'hwids'];
  const hwids = useQuery({ queryKey: key, queryFn: () => api.clientHwids(email) });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const remove = useMutation({ mutationFn: (id: number) => api.deleteHwid(email, id), onSettled: refresh });
  const clear = useMutation({ mutationFn: () => api.clearHwids(email), onSettled: refresh });
  const list = hwids.data ?? [];
  return (
    <Card>
      <Title>{t('pages.clients.hwidLog')}</Title>
      {(hwids.error || remove.error || clear.error) && <ErrorCard error={hwids.error ?? remove.error ?? clear.error} />}
      {!list.length && !hwids.isLoading && <Muted>{t('pages.clients.noHwids')}</Muted>}
      {list.map((d) => (
        <View key={d.id} style={{ gap: 4 }}>
          <Body>{[d.deviceModel, d.deviceOs && `${d.deviceOs} ${d.osVersion}`].filter(Boolean).join(' · ') || d.fingerprint}</Body>
          <Muted>
            {d.userAgent} · {new Date(d.lastSeen).toLocaleString()}
          </Muted>
          <Button
            title={t('pages.clients.deleteHwid')}
            kind="danger"
            onPress={() =>
              Alert.alert(t('pages.clients.deleteHwid'), t('pages.clients.deleteHwidConfirm'), [
                { text: t('cancel'), style: 'cancel' },
                { text: t('delete'), style: 'destructive', onPress: () => remove.mutate(d.id) },
              ])
            }
          />
        </View>
      ))}
      {list.length > 1 && (
        <Button
          title={t('clear')}
          busy={clear.isPending}
          onPress={() =>
            Alert.alert(t('pages.clients.hwidLog'), t('pages.clients.clearHwidsConfirm'), [
              { text: t('cancel'), style: 'cancel' },
              { text: t('clear'), style: 'destructive', onPress: () => clear.mutate() },
            ])
          }
        />
      )}
    </Card>
  );
}
