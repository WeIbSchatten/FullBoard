import { useMutation } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { Chips } from '@/components/Pickers';
import { SettingsEditor } from '@/components/SettingsEditor';
import { Button, Card, ErrorCard, Muted, Screen } from '@/components/ui';
import { useT } from '@/i18n';
import type { SettingsDraft } from '@/lib/settingsModel';
import { SETTING_CATEGORIES } from '@/lib/settingsSchema';
import { RequireSession, useApi } from '@/session';

function TestButton({ category }: { category: string }) {
  const api = useApi();
  const t = useT();
  const send =
    category === 'telegram'
      ? { title: t('pages.settings.testTgBot'), fn: api.testTelegram }
      : category === 'discord'
        ? { title: t('pages.settings.testDiscord'), fn: api.testDiscord }
        : category === 'email'
          ? { title: t('pages.settings.testSmtp'), fn: api.testSmtp }
          : null;
  const test = useMutation({ mutationFn: () => send!.fn() });
  if (!send) return null;
  return (
    <Card>
      <Button title={send.title} busy={test.isPending} onPress={() => test.mutate()} />
      {test.error && <ErrorCard error={test.error} />}
      {test.isSuccess && <Muted>✓ {test.data}</Muted>}
    </Card>
  );
}

function SettingsScreen() {
  const { category, node } = useLocalSearchParams<{ category: string; node?: string }>();
  const api = useApi();
  const t = useT();
  const router = useRouter();
  const nodeId = node ? Number(node) : 0;
  const cat = SETTING_CATEGORIES.find((c) => c.id === category) ?? SETTING_CATEGORIES[0];

  const remote = nodeId > 0;
  const load = remote ? () => api.remoteSettings(nodeId) : async () => (await api.allSettings()) as unknown as SettingsDraft;
  const save = remote
    ? (body: SettingsDraft) => api.updateRemoteSettings(nodeId, body)
    : (body: SettingsDraft) => api.updateSettings(body);
  const restart = remote ? () => api.remoteRestartPanel(nodeId) : api.restartPanel;

  return (
    <Screen>
      <Stack.Screen options={{ title: t(cat.title) }} />
      {remote && (
        <Chips
          options={SETTING_CATEGORIES.map((c) => ({ value: c.id, label: t(c.title) }))}
          value={cat.id}
          onChange={(id) => router.setParams({ category: id })}
        />
      )}
      <SettingsEditor
        key={`${nodeId}-${cat.id}`}
        category={cat}
        queryKey={remote ? ['node', nodeId, 'settings'] : ['settings']}
        load={load}
        save={save}
        restart={restart}
        actions={remote ? undefined : <TestButton category={cat.id} />}
      />
    </Screen>
  );
}

export default function SettingsRoute() {
  return (
    <RequireSession>
      <SettingsScreen />
    </RequireSession>
  );
}
