import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';
import type { HostGroup } from '@panel/types';

import { Chips } from '@/components/Pickers';
import { Field, SwitchRow } from '@/components/form';
import { Button, Card, ErrorCard, Loading, Screen, Title } from '@/components/ui';
import { hostGroupPayload, type HostGroupForm } from '@/lib/infraForms';
import { useT } from '@/i18n';
import { RequireSession, useApi } from '@/session';

const SECURITIES = ['same', 'none', 'tls', 'reality'];

function HostForm({ original }: { original?: HostGroup }) {
  const api = useApi();
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const inbounds = useQuery({ queryKey: ['inbounds'], queryFn: api.inbounds });
  const [form, setForm] = useState<HostGroupForm>({
    remark: original?.remark ?? '',
    hosts: original?.hosts.join(', ') ?? '',
    port: original?.port ? String(original.port) : '',
    security: original?.security ?? 'same',
    sni: original?.sni ?? '',
    path: original?.path ?? '',
    hostHeader: original?.hostHeader ?? '',
    inboundIds: original?.inboundIds ?? [],
    isDisabled: original?.isDisabled ?? false,
  });
  const set = <K extends keyof HostGroupForm>(k: K) => (v: HostGroupForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const done = () => {
    void qc.invalidateQueries({ queryKey: ['hostGroups'] });
    router.back();
  };
  const save = useMutation({
    mutationFn: () => {
      const body = hostGroupPayload(original as unknown as Record<string, unknown> | undefined, form);
      return original ? api.updateHostGroup(original.groupId, body) : api.addHostGroup(body);
    },
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: () => api.deleteHostGroup(original!.groupId), onSuccess: done });

  return (
    <Screen>
      <Card>
        <SwitchRow
          label={t('pages.hosts.fields.enable')}
          value={!form.isDisabled}
          onChange={(v) => set('isDisabled')(!v)}
          onText={t('enabled')}
          offText={t('disabled')}
        />
        <Field label={t('pages.hosts.fields.remark')} value={form.remark} onChange={set('remark')} />
        <Field label={t('pages.hosts.fields.address')} value={form.hosts} onChange={set('hosts')} multiline placeholder="cdn.example.com, cdn2.example.com:443" />
        <Field label={t('pages.hosts.fields.port')} value={form.port} onChange={set('port')} keyboard="number-pad" />
        <Title>{t('pages.hosts.fields.security')}</Title>
        <Chips options={SECURITIES.map((s) => ({ value: s, label: s }))} value={form.security} onChange={set('security')} />
        <Field label={t('pages.hosts.fields.sni')} value={form.sni} onChange={set('sni')} />
        <Field label={t('pages.hosts.fields.hostHeader')} value={form.hostHeader} onChange={set('hostHeader')} />
        <Field label={t('pages.hosts.fields.path')} value={form.path} onChange={set('path')} />
      </Card>
      <Card>
        <Title>{t('pages.hosts.fields.inbound')}</Title>
        {(inbounds.data ?? []).map((ib) => (
          <SwitchRow
            key={ib.id}
            label={`${ib.remark || ib.tag} · ${ib.protocol}:${ib.port}`}
            value={form.inboundIds.includes(ib.id)}
            onChange={(on) => set('inboundIds')(on ? [...form.inboundIds, ib.id] : form.inboundIds.filter((x) => x !== ib.id))}
          />
        ))}
      </Card>
      {(save.error || remove.error) && <ErrorCard error={save.error ?? remove.error} />}
      <Button title={t('save')} kind="primary" busy={save.isPending} onPress={() => save.mutate()} />
      {original && (
        <Button
          title={t('delete')}
          kind="danger"
          busy={remove.isPending}
          onPress={() =>
            Alert.alert(t('pages.hosts.deleteConfirmTitle'), '', [
              { text: t('cancel'), style: 'cancel' },
              { text: t('delete'), style: 'destructive', onPress: () => remove.mutate() },
            ])
          }
        />
      )}
    </Screen>
  );
}

function HostEditScreen() {
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const api = useApi();
  const t = useT();
  const groups = useQuery({ queryKey: ['hostGroups'], queryFn: api.hostGroups, enabled: !!groupId });
  if (groupId && groups.isLoading) return <Loading />;
  const original = groupId ? groups.data?.find((g) => g.groupId === groupId) : undefined;
  return (
    <>
      <Stack.Screen options={{ title: original ? t('pages.hosts.editHost') : t('pages.hosts.addHost') }} />
      <HostForm original={original} />
    </>
  );
}

export default function HostEditRoute() {
  return (
    <RequireSession>
      <HostEditScreen />
    </RequireSession>
  );
}
