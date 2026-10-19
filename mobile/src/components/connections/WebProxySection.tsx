import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';

import { QrCode } from '@/components/QrCode';
import { Badge, Body, Button, Card, ErrorCard, Muted, Row, Title } from '@/components/ui';
import { useT } from '@/i18n';
import { useApi } from '@/session';

const isManaged = (name: string) => name.startsWith('fb:');

function ShareRow({ name }: { name: string }) {
  const api = useApi();
  const t = useT();
  const [qr, setQr] = useState(false);
  const share = useQuery({ queryKey: ['webProxy', 'share', name], queryFn: () => api.webProxyShare(name), enabled: qr });
  return (
    <View style={{ gap: 6 }}>
      <Button title={t('pages.tgWebProxy.share.button')} onPress={() => setQr((v) => !v)} />
      {qr && share.error && <ErrorCard error={share.error} />}
      {qr && share.data && (
        <Pressable onPress={() => void Clipboard.setStringAsync(share.data.link)} style={{ alignItems: 'center', gap: 6 }}>
          <QrCode value={share.data.link} size={200} />
          <Muted numberOfLines={2}>{share.data.link}</Muted>
          <Muted>{t('copy')}</Muted>
        </Pressable>
      )}
    </View>
  );
}

export function WebProxySection() {
  const api = useApi();
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ['webProxy', 'status'], queryFn: api.webProxyStatus });
  const installed = !!status.data?.binaryInstalled && !!status.data.configExists;
  const config = useQuery({ queryKey: ['webProxy', 'config'], queryFn: api.webProxyConfig, enabled: installed });
  const bindings = useQuery({ queryKey: ['webProxy', 'bindings'], queryFn: api.webProxyBindings, enabled: installed });
  const refresh = () => qc.invalidateQueries({ queryKey: ['webProxy'] });
  const unit = useMutation({
    mutationFn: ({ name, action }: { name: string; action: string }) => api.webProxyUnit(name, action),
    onSettled: refresh,
  });
  const unbind = useMutation({ mutationFn: (email: string) => api.webProxyUnbind(email), onSettled: refresh });

  if (status.error) return <ErrorCard error={status.error} onRetry={() => void status.refetch()} />;
  if (status.data && !status.data.supported) return <Muted>{t('pages.tgWebProxy.unsupported')}</Muted>;
  if (status.data && !installed) return <Muted>{t('tgbot.messages.webProxyNotInstalled')}</Muted>;
  const profiles = (config.data?.profiles ?? []).filter((p) => !isManaged(p.name));

  return (
    <>
      <Card>
        <Title>{t('pages.tgWebProxy.relay')}</Title>
        <Row label={t('pages.tgWebProxy.hostname')} value={status.data?.hostname ?? ''} />
        {(unit.error || unbind.error) && <ErrorCard error={unit.error ?? unbind.error} />}
        {(status.data?.units ?? []).map((u) => (
          <View key={u.unit} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Body>{u.unit}</Body>
              <Badge text={`${u.activeState}/${u.subState}`} tone={u.activeState === 'active' ? 'success' : 'error'} />
            </View>
            {u.controllable && (
              <Button
                title={`${t('pages.index.restartXray')} · ${u.unit}`}
                busy={unit.isPending && unit.variables?.name === u.unit}
                onPress={() => unit.mutate({ name: u.unit, action: 'restart' })}
              />
            )}
          </View>
        ))}
      </Card>
      <Button
        title={t('pages.tgWebProxy.profile.add')}
        kind="primary"
        onPress={() => router.push({ pathname: '/webproxy/profile', params: { name: '' } })}
      />
      {profiles.map((p) => (
        <Card key={p.name}>
          <Pressable onPress={() => router.push({ pathname: '/webproxy/profile', params: { name: p.name } })}>
            <Body>{p.name}</Body>
            <Muted>
              {p.backend} · {p.carrier_mode || 'https'}
            </Muted>
          </Pressable>
          <ShareRow name={p.name} />
        </Card>
      ))}
      <Card>
        <Title>{t('pages.tgWebProxy.bindings.title')}</Title>
        {!bindings.data?.bindings.length && <Muted>{t('pages.tgWebProxy.bindings.empty')}</Muted>}
        {(bindings.data?.bindings ?? []).map((b) => (
          <View key={b.email} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Body>{b.email}</Body>
              <Muted>
                {b.effectiveProfile}
                {b.nodeId != null ? ` · #${b.nodeId}` : ''}
              </Muted>
            </View>
            <Button
              title={t('pages.tgWebProxy.bindings.unbind')}
              onPress={() =>
                Alert.alert(t('pages.tgWebProxy.bindings.unbindConfirm', { email: b.email }), '', [
                  { text: t('cancel'), style: 'cancel' },
                  { text: t('pages.tgWebProxy.bindings.unbind'), style: 'destructive', onPress: () => unbind.mutate(b.email) },
                ])
              }
            />
          </View>
        ))}
      </Card>
    </>
  );
}
