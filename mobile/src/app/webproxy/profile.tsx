import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';
import type { RelayProfile } from '@panel/types';

import { Chips } from '@/components/Pickers';
import { Field, SwitchRow } from '@/components/form';
import { Button, Card, ErrorCard, Loading, Muted, Screen, Title } from '@/components/ui';
import { deviceRandom } from '@/lib/random';
import { useT } from '@/i18n';
import { RequireSession, useApi } from '@/session';

// Same choices and secret format as frontend/src/lib/tgWebProxy.ts.
const CARRIER_MODES = ['https', 'https-lanes', 'websocket', 'websocket-lanes'];
const SECRET_PATTERN = /^(dd)?[0-9a-f]{32}$/;

function nextBackend(backends: string[]): string {
  const ports = backends.map((b) => Number(/:(\d+)$/.exec(b)?.[1])).filter((n) => n > 0);
  return `127.0.0.1:${ports.length ? Math.max(...ports) + 1 : 2398}`;
}

function ProfileForm({ original, existing }: { original?: RelayProfile; existing: RelayProfile[] }) {
  const api = useApi();
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState(original?.name ?? '');
  const [secret, setSecret] = useState(original?.secret ?? deviceRandom.hex(16));
  const [backend, setBackend] = useState(original?.backend ?? nextBackend(existing.map((p) => p.backend)));
  const [mode, setMode] = useState(original?.carrier_mode || 'https');
  const [emails, setEmails] = useState('');
  const [dedicated, setDedicated] = useState(true);
  const done = () => {
    void qc.invalidateQueries({ queryKey: ['webProxy'] });
    router.back();
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error(`${t('pages.tgWebProxy.profile.name')}: —`);
      if (!SECRET_PATTERN.test(secret.trim())) throw new Error(`${t('pages.tgWebProxy.secret')}: 32 hex`);
      const profile: RelayProfile = { ...(original ?? {}), name: name.trim(), secret: secret.trim(), backend: backend.trim(), carrier_mode: mode };
      return original ? api.webProxyUpdateProfile(original.name, profile) : api.webProxyAddProfile(profile);
    },
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: () => api.webProxyDeleteProfile(original!.name), onSuccess: done });
  const bind = useMutation({
    mutationFn: () =>
      api.webProxyBindMany(
        emails.split(/[\s,]+/).filter(Boolean),
        original!.name,
        dedicated,
      ),
    onSuccess: () => {
      setEmails('');
      void qc.invalidateQueries({ queryKey: ['webProxy'] });
    },
  });

  return (
    <Screen>
      <Card>
        <Field label={t('pages.tgWebProxy.profile.name')} value={name} onChange={setName} />
        <Field label={t('pages.tgWebProxy.secret')} value={secret} onChange={setSecret} />
        <Button title={t('regenerate')} onPress={() => setSecret(deviceRandom.hex(16))} />
        <Field
          label={t('pages.tgWebProxy.profile.backend')}
          value={backend}
          onChange={setBackend}
          hint={t('pages.tgWebProxy.profile.backendHint')}
        />
        <Title>{t('pages.tgWebProxy.profile.carrierMode')}</Title>
        <Chips options={CARRIER_MODES.map((m) => ({ value: m, label: m }))} value={mode} onChange={setMode} />
        <Muted>{t('pages.tgWebProxy.profile.carrierHint')}</Muted>
      </Card>
      {(save.error || remove.error) && <ErrorCard error={save.error ?? remove.error} />}
      <Button title={t('save')} kind="primary" busy={save.isPending} onPress={() => save.mutate()} />
      {original && (
        <>
          <Card>
            <Title>{t('pages.tgWebProxy.bindings.addToSubs')}</Title>
            <Muted>{t('pages.tgWebProxy.bindings.addToSubsHint')}</Muted>
            <Field
              label={t('pages.tgWebProxy.bindings.selectClients')}
              value={emails}
              onChange={setEmails}
              placeholder="alice, bob"
              multiline
            />
            <SwitchRow label={t('pages.tgWebProxy.bindings.dedicated')} value={dedicated} onChange={setDedicated} />
            {bind.error && <ErrorCard error={bind.error} />}
            <Button title={t('add')} disabled={!emails.trim()} busy={bind.isPending} onPress={() => bind.mutate()} />
          </Card>
          <Button
            title={t('delete')}
            kind="danger"
            busy={remove.isPending}
            onPress={() =>
              Alert.alert(t('pages.tgWebProxy.profile.deleteConfirm', { name: original.name }), '', [
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

function ProfileScreen() {
  const { name } = useLocalSearchParams<{ name?: string }>();
  const api = useApi();
  const t = useT();
  const config = useQuery({ queryKey: ['webProxy', 'config'], queryFn: api.webProxyConfig });
  if (config.isLoading) return <Loading />;
  if (!config.data) return <Screen>{config.error && <ErrorCard error={config.error} />}</Screen>;
  const original = name ? config.data.profiles?.find((p) => p.name === name) : undefined;
  return (
    <>
      <Stack.Screen options={{ title: original ? t('pages.tgWebProxy.profile.edit') : t('pages.tgWebProxy.profile.add') }} />
      <ProfileForm original={original} existing={config.data.profiles ?? []} />
    </>
  );
}

export default function WebProxyProfileRoute() {
  return (
    <RequireSession>
      <ProfileScreen />
    </RequireSession>
  );
}
