import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Switch, Text, TextInput, View } from 'react-native';

import { Button, Card, ErrorCard, Muted, Screen, Title } from '@/components/ui';
import { buildNewClient, randomEmail, type NewClientForm } from '@/lib/newClient';
import { t } from '@/i18n';
import { RequireSession, useApi } from '@/session';
import { usePalette } from '@/theme';

// Inbounds whose clients are not individual accounts cannot take a new client.
const NO_CLIENTS = new Set(['tunnel', 'dokodemo-door', 'mixed', 'http', 'socks']);

function NewClientScreen() {
  const api = useApi();
  const p = usePalette();
  const router = useRouter();
  const qc = useQueryClient();
  const inbounds = useQuery({ queryKey: ['inbounds'], queryFn: api.inbounds });
  const [form, setForm] = useState<NewClientForm>({
    email: randomEmail(),
    totalGB: '0',
    days: '30',
    limitIp: '0',
    comment: '',
  });
  const [selected, setSelected] = useState<number[]>([]);
  const create = useMutation({
    mutationFn: () => api.addClient(buildNewClient(form), selected),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['clients'] });
      router.back();
    },
  });

  const field = (key: keyof NewClientForm, label: string, numeric = false) => (
    <View style={{ gap: 4 }}>
      <Text style={{ color: p.text2 }}>{label}</Text>
      <TextInput
        value={form[key]}
        onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        autoCapitalize="none"
        style={{
          color: p.text,
          backgroundColor: p.surface2,
          borderColor: p.border,
          borderWidth: 1,
          borderRadius: 12,
          paddingHorizontal: 12,
          minHeight: 44,
        }}
      />
    </View>
  );

  const eligible = (inbounds.data ?? []).filter((ib) => !NO_CLIENTS.has(ib.protocol));

  return (
    <Screen>
      <Card>
        {field('email', t.client.email)}
        {field('totalGB', t.client.totalGB, true)}
        {field('days', t.client.days, true)}
        {field('limitIp', t.client.limitIp, true)}
        {field('comment', t.client.comment)}
      </Card>
      <Card>
        <Title>{t.client.inbounds}</Title>
        {inbounds.error && <ErrorCard error={inbounds.error} />}
        {eligible.map((ib) => (
          <View key={ib.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.text }}>{ib.remark || ib.tag}</Text>
              <Muted>
                {ib.protocol} · {ib.port}
              </Muted>
            </View>
            <Switch
              value={selected.includes(ib.id)}
              onValueChange={(on) =>
                setSelected((s) => (on ? [...s, ib.id] : s.filter((id) => id !== ib.id)))
              }
            />
          </View>
        ))}
      </Card>
      {create.error && <ErrorCard error={create.error} />}
      <Button
        title={t.client.create}
        kind="primary"
        busy={create.isPending}
        disabled={selected.length === 0}
        onPress={() => create.mutate()}
      />
    </Screen>
  );
}

export default function NewClientRoute() {
  return (
    <RequireSession>
      <NewClientScreen />
    </RequireSession>
  );
}
