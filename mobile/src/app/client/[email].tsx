import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, Switch, Text, View } from 'react-native';

import { QrCode } from '@/components/QrCode';
import { Badge, Body, Button, Card, ErrorCard, Loading, Muted, Row, Screen, Title } from '@/components/ui';
import { clientView } from '@/lib/clientView';
import { formatBytes } from '@/lib/format';
import { CLIENT_STATE_TONE, clientStateLabel, expiryLabel } from '@/lib/labels';
import { useT } from '@/i18n';
import { RequireSession, useApi } from '@/session';
import { usePalette } from '@/theme';

function LinkRow({ value }: { value: string }) {
  const t = useT();
  const [qr, setQr] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Muted numberOfLines={2}>{value}</Muted>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button
            title={copied ? t('copied') : t('copy')}
            onPress={() => {
              void Clipboard.setStringAsync(value);
              setCopied(true);
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={t('qrCode')} onPress={() => setQr((v) => !v)} />
        </View>
      </View>
      {qr && (
        <Pressable onPress={() => setQr(false)} style={{ alignItems: 'center', paddingVertical: 8 }}>
          <QrCode value={value} />
        </Pressable>
      )}
    </View>
  );
}

function ClientScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const api = useApi();
  const t = useT();
  const p = usePalette();
  const router = useRouter();
  const qc = useQueryClient();
  const client = useQuery({ queryKey: ['client', email], queryFn: () => api.client(email) });
  const links = useQuery({ queryKey: ['client', email, 'links'], queryFn: () => api.clientLinks(email) });
  const sub = useQuery({ queryKey: ['subSettings'], queryFn: api.subSettings, staleTime: 300_000 });
  const page = useQuery({ queryKey: ['clients', email], queryFn: () => api.clients(1, email) });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['clients'] });
    void qc.invalidateQueries({ queryKey: ['client', email] });
  };
  const toggle = useMutation({
    mutationFn: (enable: boolean) => api.setClientsEnabled([email], enable),
    onSettled: refresh,
  });
  const reset = useMutation({ mutationFn: () => api.resetTraffic(email), onSettled: refresh });
  const remove = useMutation({
    mutationFn: () => api.deleteClient(email),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['clients'] });
      router.back();
    },
  });

  if (client.isLoading) return <Loading />;
  const slim = page.data?.items.find((i) => i.email === email);
  const view = client.data ? clientView(client.data, slim?.traffic, sub.data) : null;
  const c = view?.client;
  const error = client.error ?? toggle.error ?? reset.error ?? remove.error;
  // While the toggle is in flight, show where it is going rather than the stale value.
  const enabled = toggle.isPending && toggle.variables !== undefined ? toggle.variables : !!c?.enable;
  const usage = view?.usage;

  return (
    <Screen refreshing={client.isRefetching} onRefresh={refresh}>
      <Stack.Screen options={{ title: email }} />
      {error && <ErrorCard error={error} />}
      {c && view && usage && (
        <>
          <Card>
            <Row
              label={t('subscription.status')}
              value={<Badge text={clientStateLabel(t, view.state)} tone={CLIENT_STATE_TONE[view.state]} />}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: p.text2 }}>{t('pages.clients.enabled')}</Text>
                <Text style={{ color: enabled ? p.success : p.text3, fontWeight: '600' }}>
                  {enabled ? t('enabled') : t('disabled')}
                </Text>
              </View>
              <Switch
                value={enabled}
                disabled={toggle.isPending}
                onValueChange={(v) => toggle.mutate(v)}
                trackColor={{ false: p.surface2, true: p.success }}
                thumbColor={enabled ? p.onAccent : p.text3}
              />
            </View>
            <Row
              label={t('pages.clients.traffic')}
              value={`${formatBytes(usage.used)} / ${usage.total ? formatBytes(usage.total) : t('unlimited')}`}
            />
            <Row label={t('pages.clients.expiryTime')} value={expiryLabel(t, c.expiryTime)} />
            {!!c.comment && <Body>{c.comment}</Body>}
          </Card>
          {!!view.subUrl && (
            <Card>
              <Title>{t('subscription.tabLinks')}</Title>
              <LinkRow value={view.subUrl} />
              {!!view.jsonUrl && <LinkRow value={view.jsonUrl} />}
            </Card>
          )}
          {!!links.data?.length && (
            <Card>
              <Title>{t('pages.clients.tabLinks')}</Title>
              {links.data.map((l) => (
                <LinkRow key={l} value={l} />
              ))}
            </Card>
          )}
          <Button
            title={t('pages.groups.resetTraffic')}
            busy={reset.isPending}
            onPress={() =>
              Alert.alert(t('pages.groups.resetTraffic'), t('pages.inbounds.resetTrafficContent'), [
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
              Alert.alert(t('pages.clients.deleteConfirmTitle', { email }), '', [
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

export default function ClientRoute() {
  return (
    <RequireSession>
      <ClientScreen />
    </RequireSession>
  );
}
