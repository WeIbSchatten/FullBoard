import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Chips } from '@/components/Pickers';
import { Field, SwitchRow } from '@/components/form';
import { Button, Card, ErrorCard, Loading, Muted, Screen, Title } from '@/components/ui';
import {
  TRAFFIC_RESETS,
  formFromRecord,
  recordFromForm,
  type ClientForm,
  type ClientFormRecord,
  type ExpiryMode,
} from '@/lib/clientForm';
import { useT } from '@/i18n';
import { RequireSession, useApi } from '@/session';
import { usePalette } from '@/theme';

const NO_CLIENTS = new Set(['tunnel', 'dokodemo-door', 'mixed', 'http', 'socks']);

function EditForm({ record, attached }: { record: ClientFormRecord; attached: number[] }) {
  const api = useApi();
  const t = useT();
  const p = usePalette();
  const router = useRouter();
  const qc = useQueryClient();
  const inbounds = useQuery({ queryKey: ['inbounds'], queryFn: api.inbounds });
  const groups = useQuery({ queryKey: ['groups'], queryFn: api.groups });
  const [form, setForm] = useState<ClientForm>(() => formFromRecord(record));
  const [selected, setSelected] = useState<number[]>(attached);
  const set = <K extends keyof ClientForm>(key: K) => (v: ClientForm[K]) => setForm((f) => ({ ...f, [key]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const next = recordFromForm(record, form);
      await api.updateClient(record.email, next);
      const add = selected.filter((id) => !attached.includes(id));
      const remove = attached.filter((id) => !selected.includes(id));
      if (add.length) await api.attachClient(next.email, add);
      if (remove.length) await api.detachClient(next.email, remove);
      return next.email;
    },
    onSuccess: (email) => {
      void qc.invalidateQueries({ queryKey: ['clients'] });
      void qc.invalidateQueries({ queryKey: ['client'] });
      void qc.invalidateQueries({ queryKey: ['groups'] });
      if (email !== record.email) router.dismissTo({ pathname: '/client/[email]', params: { email } });
      else router.back();
    },
  });

  const expiryModes: { value: ExpiryMode; label: string }[] = [
    { value: 'never', label: t('indefinite') },
    { value: 'date', label: t('pages.clients.expireDays') },
    { value: 'afterFirstUse', label: t('pages.clients.delayedStart') },
  ];
  const eligible = (inbounds.data ?? []).filter((ib) => !NO_CLIENTS.has(ib.protocol));

  return (
    <Screen>
      <Card>
        <SwitchRow
          label={t('pages.clients.enabled')}
          value={form.enable}
          onChange={set('enable')}
          onText={t('enabled')}
          offText={t('disabled')}
        />
        <Field label={t('pages.clients.email')} value={form.email} onChange={set('email')} />
        <Field label={t('comment')} value={form.comment} onChange={set('comment')} multiline />
        <Field
          label={t('pages.clients.group')}
          value={form.group}
          onChange={set('group')}
          placeholder={t('pages.clients.groupPlaceholder')}
        />
        {!!groups.data?.length && (
          <Chips
            options={groups.data.map((g) => ({ value: g.name, label: g.name }))}
            value={form.group}
            onChange={set('group')}
          />
        )}
      </Card>
      <Card>
        <Title>{t('pages.clients.expiryTime')}</Title>
        <Chips options={expiryModes} value={form.expiryMode} onChange={set('expiryMode')} />
        {form.expiryMode !== 'never' && (
          <Field
            label={t('pages.clients.expireDays')}
            value={form.expiryDays}
            onChange={set('expiryDays')}
            keyboard="number-pad"
          />
        )}
        <Field
          label={t('pages.clients.totalGB')}
          value={form.totalGB}
          onChange={set('totalGB')}
          keyboard="decimal-pad"
          hint={t('pages.clients.totalGBDesc')}
        />
        <Text style={{ color: p.text2 }}>{t('pages.inbounds.periodicTrafficResetTitle')}</Text>
        <Chips
          options={TRAFFIC_RESETS.map((r) => ({ value: r, label: t(`pages.inbounds.periodicTrafficReset.${r}`) }))}
          value={form.trafficReset}
          onChange={set('trafficReset')}
        />
      </Card>
      <Card>
        <Field
          label={t('pages.clients.limitIp')}
          value={form.limitIp}
          onChange={set('limitIp')}
          keyboard="number-pad"
          hint={t('pages.clients.limitIpDesc')}
        />
        <Field
          label={t('pages.clients.limitHwid')}
          value={form.limitHwid}
          onChange={set('limitHwid')}
          keyboard="number-pad"
          hint={t('pages.clients.limitHwidDesc')}
        />
        <Field
          label={t('pages.clients.telegramId')}
          value={form.tgId}
          onChange={set('tgId')}
          keyboard="number-pad"
          placeholder={t('pages.clients.telegramIdPlaceholder')}
        />
        <Field
          label={t('pages.clients.subId')}
          value={form.subId}
          onChange={set('subId')}
          hint={t('pages.clients.subIdDesc')}
        />
      </Card>
      <Card>
        <Title>{t('pages.clients.attachedInbounds')}</Title>
        {inbounds.error && <ErrorCard error={inbounds.error} />}
        {eligible.map((ib) => (
          <SwitchRow
            key={ib.id}
            label={`${ib.remark || ib.tag} · ${ib.protocol}:${ib.port}`}
            value={selected.includes(ib.id)}
            onChange={(on) => setSelected((s) => (on ? [...s, ib.id] : s.filter((id) => id !== ib.id)))}
          />
        ))}
        {!eligible.length && !inbounds.isLoading && <Muted>{t('noData')}</Muted>}
      </Card>
      {save.error && <ErrorCard error={save.error} />}
      <View style={{ gap: 8 }}>
        <Button title={t('pages.clients.submitEdit')} kind="primary" busy={save.isPending} onPress={() => save.mutate()} />
      </View>
    </Screen>
  );
}

function EditClientScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const api = useApi();
  const detail = useQuery({ queryKey: ['client', email], queryFn: () => api.client(email) });
  if (detail.isLoading) return <Loading />;
  if (detail.error || !detail.data) return <Screen>{detail.error && <ErrorCard error={detail.error} />}</Screen>;
  return (
    <>
      <Stack.Screen options={{ title: email }} />
      <EditForm record={detail.data.client as ClientFormRecord} attached={detail.data.inboundIds ?? []} />
    </>
  );
}

export default function EditClientRoute() {
  return (
    <RequireSession>
      <EditClientScreen />
    </RequireSession>
  );
}
