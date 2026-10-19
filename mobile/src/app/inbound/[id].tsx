import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';

import { SwitchRow } from '@/components/form';
import { Badge, Body, Button, Card, ErrorCard, Loading, Muted, Row, Screen, Title } from '@/components/ui';
import { formatBytes } from '@/lib/format';
import { expiryLabel } from '@/lib/labels';
import { useT } from '@/i18n';
import { RequireSession, useApi } from '@/session';

function InboundScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const inboundId = Number(id);
  const api = useApi();
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const inbound = useQuery({ queryKey: ['inbound', inboundId], queryFn: () => api.inbound(inboundId) });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['inbound', inboundId] });
    void qc.invalidateQueries({ queryKey: ['inbounds'] });
  };
  const toggle = useMutation({ mutationFn: (enable: boolean) => api.setInboundEnabled(inboundId, enable), onSettled: refresh });
  const reset = useMutation({ mutationFn: () => api.resetInboundTraffic(inboundId), onSettled: refresh });
  const remove = useMutation({
    mutationFn: () => api.deleteInbound(inboundId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inbounds'] });
      router.back();
    },
  });

  if (inbound.isLoading) return <Loading />;
  const ib = inbound.data;
  const error = inbound.error ?? toggle.error ?? reset.error ?? remove.error;
  const enabled = toggle.isPending && toggle.variables !== undefined ? toggle.variables : !!ib?.enable;

  return (
    <Screen refreshing={inbound.isRefetching} onRefresh={refresh}>
      <Stack.Screen options={{ title: ib?.remark ?? '' }} />
      {error && <ErrorCard error={error} />}
      {ib && (
        <>
          <Card>
            <SwitchRow
              label={t('enable')}
              value={enabled}
              onChange={(v) => toggle.mutate(v)}
              onText={t('enabled')}
              offText={t('disabled')}
              disabled={toggle.isPending}
            />
            <Row label={t('protocol')} value={ib.protocol} />
            <Row label={t('pages.inbounds.port')} value={String(ib.port)} />
            {!!ib.listen && <Row label={t('monitor')} value={ib.listen} />}
            <Row label="Tag" value={ib.tag} />
            <Row
              label={t('pages.inbounds.traffic')}
              value={`↑ ${formatBytes(ib.up)} ↓ ${formatBytes(ib.down)}${ib.total ? ` / ${formatBytes(ib.total)}` : ''}`}
            />
            <Row label={t('pages.inbounds.expireDate')} value={expiryLabel(t, ib.expiryTime)} />
          </Card>
          <Card>
            <Title>
              {t('clients')}: {ib.clientStats?.length ?? 0}
            </Title>
            {(ib.clientStats ?? []).map((c) => (
              <Pressable
                key={c.email}
                onPress={() => router.push({ pathname: '/client/[email]', params: { email: c.email } })}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
                  <View style={{ flex: 1 }}>
                    <Body>{c.email}</Body>
                    <Muted>
                      ↑ {formatBytes(c.up)} ↓ {formatBytes(c.down)}
                    </Muted>
                  </View>
                  <Badge text={c.enable ? t('enabled') : t('disabled')} tone={c.enable ? 'success' : 'muted'} />
                </View>
              </Pressable>
            ))}
          </Card>
          <Button
            title={t('pages.inbounds.modifyInbound')}
            kind="primary"
            onPress={() => router.push({ pathname: '/inbound/edit', params: { id: String(inboundId) } })}
          />
          <Button
            title={t('pages.inbounds.resetTraffic')}
            busy={reset.isPending}
            onPress={() =>
              Alert.alert(t('pages.inbounds.resetConfirmTitle', { remark: ib.remark }), t('pages.inbounds.resetConfirmContent'), [
                { text: t('cancel'), style: 'cancel' },
                { text: t('sure'), onPress: () => reset.mutate() },
              ])
            }
          />
          <Button
            title={t('delete')}
            kind="danger"
            busy={remove.isPending}
            onPress={() =>
              Alert.alert(t('pages.inbounds.deleteConfirmTitle', { remark: ib.remark }), t('pages.inbounds.deleteConfirmContent'), [
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

export default function InboundRoute() {
  return (
    <RequireSession>
      <InboundScreen />
    </RequireSession>
  );
}
