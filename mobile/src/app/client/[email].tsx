import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, Switch, View } from 'react-native';

import { QrCode } from '@/components/QrCode';
import { Body, Button, Card, ErrorCard, Loading, Muted, Row, Screen, Title } from '@/components/ui';
import { formatBytes, quotaUsage } from '@/lib/format';
import { expiryLabel } from '@/lib/labels';
import { t } from '@/i18n';
import { RequireSession, useApi } from '@/session';

function LinkRow({ value }: { value: string }) {
  const [qr, setQr] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Muted numberOfLines={2}>{value}</Muted>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button
            title={copied ? t.client.copied : t.client.copy}
            onPress={() => {
              void Clipboard.setStringAsync(value);
              setCopied(true);
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={t.client.showQr} onPress={() => setQr((v) => !v)} />
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
  const c = client.data;
  const slim = page.data?.items.find((i) => i.email === email);
  const usage = quotaUsage(c?.totalGB ?? 0, slim?.traffic);
  const subUrl = c?.subId && sub.data?.subEnable && sub.data.subURI ? sub.data.subURI + c.subId : '';
  const jsonUrl =
    c?.subId && sub.data?.subJsonEnable && sub.data.subJsonURI ? sub.data.subJsonURI + c.subId : '';
  const error = client.error ?? toggle.error ?? reset.error ?? remove.error;

  return (
    <Screen refreshing={client.isRefetching} onRefresh={refresh}>
      <Stack.Screen options={{ title: email }} />
      {error && <ErrorCard error={error} />}
      {c && (
        <>
          <Card>
            <Row
              label={t.client.enabled}
              value={
                <Switch
                  value={c.enable}
                  disabled={toggle.isPending}
                  onValueChange={(v) => toggle.mutate(v)}
                />
              }
            />
            <Row
              label={t.client.traffic}
              value={`${formatBytes(usage.used)} / ${usage.total ? formatBytes(usage.total) : t.clients.unlimited}`}
            />
            <Row label={t.client.expiry} value={expiryLabel(c.expiryTime)} />
            {!!c.comment && <Body>{c.comment}</Body>}
          </Card>
          {!!subUrl && (
            <Card>
              <Title>{t.client.subscription}</Title>
              <LinkRow value={subUrl} />
              {!!jsonUrl && <LinkRow value={jsonUrl} />}
            </Card>
          )}
          {!!links.data?.length && (
            <Card>
              <Title>{t.client.links}</Title>
              {links.data.map((l) => (
                <LinkRow key={l} value={l} />
              ))}
            </Card>
          )}
          <Button
            title={t.client.resetTraffic}
            busy={reset.isPending}
            onPress={() =>
              Alert.alert(t.client.resetTraffic, t.client.resetConfirm, [
                { text: t.common.cancel, style: 'cancel' },
                { text: t.common.ok, onPress: () => reset.mutate() },
              ])
            }
          />
          <Button
            title={t.client.delete}
            kind="danger"
            busy={remove.isPending}
            onPress={() =>
              Alert.alert(t.client.delete, t.client.deleteConfirm, [
                { text: t.common.cancel, style: 'cancel' },
                { text: t.common.ok, style: 'destructive', onPress: () => remove.mutate() },
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
