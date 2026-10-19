import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import { Alert, Switch, View } from 'react-native';
import type { ApiTokenView } from '@panel/types';

import type { ApiTokenScope } from '@/api/panel';
import { Chips } from '@/components/Pickers';
import { Field } from '@/components/form';
import { Badge, Body, Button, Card, ErrorCard, Muted, Screen, Title } from '@/components/ui';
import { useT } from '@/i18n';
import { toMillis } from '@/lib/format';
import { RequireSession, useApi } from '@/session';
import { usePalette } from '@/theme';

const SCOPES: { value: ApiTokenScope; key: string }[] = [
  { value: 'admin', key: 'Admin' },
  { value: 'monitor', key: 'Monitor' },
  { value: 'node-sync', key: 'NodeSync' },
  { value: 'node-admin', key: 'NodeAdmin' },
];
const scopeLabel = (t: ReturnType<typeof useT>, scope: string) => {
  const s = SCOPES.find((x) => x.value === scope);
  return s ? t(`pages.settings.security.apiTokenScope${s.key}`) : scope;
};

function CreatedToken({ token, onDone }: { token: ApiTokenView; onDone: () => void }) {
  const t = useT();
  return (
    <Card>
      <Title>{t('pages.settings.security.apiTokenCreatedTitle')}</Title>
      <Muted>{t('pages.settings.security.apiTokenCreatedNotice')}</Muted>
      <Body selectable>{token.token}</Body>
      <Button title={t('copy')} kind="primary" onPress={() => void Clipboard.setStringAsync(token.token ?? '')} />
      <Button title={t('close')} onPress={onDone} />
    </Card>
  );
}

function TokensScreen() {
  const api = useApi();
  const t = useT();
  const p = usePalette();
  const qc = useQueryClient();
  const tokens = useQuery({ queryKey: ['apiTokens'], queryFn: api.apiTokens });
  const [name, setName] = useState('');
  const [scope, setScope] = useState<ApiTokenScope>('admin');
  const [created, setCreated] = useState<ApiTokenView | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['apiTokens'] });
  const create = useMutation({
    mutationFn: () => api.createApiToken(name.trim(), scope, 0),
    onSuccess: (tok) => {
      setCreated(tok);
      setName('');
      void refresh();
    },
  });
  const toggle = useMutation({
    mutationFn: ({ tok, on }: { tok: ApiTokenView; on: boolean }) => api.setApiTokenEnabled(tok, on),
    onSettled: refresh,
  });
  const remove = useMutation({ mutationFn: api.deleteApiToken, onSettled: refresh });

  return (
    <Screen refreshing={tokens.isRefetching} onRefresh={() => void tokens.refetch()}>
      <Stack.Screen options={{ title: t('pages.nodes.apiToken') }} />
      {created && <CreatedToken token={created} onDone={() => setCreated(null)} />}
      <Card>
        <Title>{t('pages.settings.security.apiTokenNew')}</Title>
        <Field
          label={t('pages.settings.security.apiTokenName')}
          value={name}
          onChange={setName}
          placeholder={t('pages.settings.security.apiTokenNamePlaceholder')}
        />
        <Muted>{t('pages.settings.security.apiTokenScope')}</Muted>
        <Chips options={SCOPES.map((s) => ({ value: s.value, label: scopeLabel(t, s.value) }))} value={scope} onChange={setScope} />
        <Muted>{t(`pages.settings.security.apiTokenScope${SCOPES.find((s) => s.value === scope)!.key}Desc`)}</Muted>
        <Button title={t('create')} kind="primary" disabled={!name.trim()} busy={create.isPending} onPress={() => create.mutate()} />
      </Card>
      {(tokens.error || create.error || toggle.error || remove.error) && (
        <ErrorCard error={tokens.error ?? create.error ?? toggle.error ?? remove.error} />
      )}
      {tokens.data?.length === 0 && <Muted>{t('pages.settings.security.apiTokenEmpty')}</Muted>}
      {(tokens.data ?? []).map((tok) => (
        <Card key={tok.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Body>{tok.name}</Body>
              <Muted>{new Date(toMillis(tok.createdAt)).toLocaleString()}</Muted>
            </View>
            <Badge text={scopeLabel(t, tok.scope)} tone={tok.scope === 'admin' ? 'warning' : 'muted'} />
            <Switch
              value={tok.enabled}
              disabled={toggle.isPending}
              onValueChange={(on) => toggle.mutate({ tok, on })}
              trackColor={{ false: p.surface2, true: p.success }}
            />
          </View>
          <Button
            title={t('delete')}
            kind="danger"
            onPress={() =>
              Alert.alert(tok.name, t('pages.settings.security.apiTokenDeleteWarning'), [
                { text: t('cancel'), style: 'cancel' },
                { text: t('delete'), style: 'destructive', onPress: () => remove.mutate(tok) },
              ])
            }
          />
        </Card>
      ))}
    </Screen>
  );
}

export default function TokensRoute() {
  return (
    <RequireSession>
      <TokensScreen />
    </RequireSession>
  );
}
