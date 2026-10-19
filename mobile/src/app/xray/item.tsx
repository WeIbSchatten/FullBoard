import { useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Text } from 'react-native';

import { Field } from '@/components/form';
import { Button, Card, Muted, Screen } from '@/components/ui';
import { getSection, listOf, removeItem, setSection, upsertItem } from '@/lib/xrayConfig';
import { useT } from '@/i18n';
import { RequireSession } from '@/session';
import { usePalette } from '@/theme';
import { useXrayDraft, xrayDraft } from '@/xrayDraft';

// index -1 adds a new list item, -2 edits the section at `path` as a whole
// ("" means the full template).
const NEW_ITEMS: Record<string, unknown> = {
  outbounds: { tag: 'new-outbound', protocol: 'freedom', settings: {} },
  'routing.rules': { type: 'field', domain: [], outboundTag: 'direct' },
  'routing.balancers': { tag: 'balancer', selector: [], strategy: { type: 'random' } },
  'dns.servers': '1.1.1.1',
};

function ItemScreen() {
  const { path = '', index: rawIndex = '-1' } = useLocalSearchParams<{ path: string; index: string }>();
  const index = Number(rawIndex);
  const t = useT();
  const p = usePalette();
  const router = useRouter();
  const { cfg } = useXrayDraft();
  const whole = index === -2;
  const current = !cfg
    ? undefined
    : whole
      ? path
        ? getSection(cfg, path)
        : cfg
      : index >= 0
        ? listOf(cfg, path)[index]
        : NEW_ITEMS[path];
  const [text, setText] = useState(() => JSON.stringify(current ?? {}, null, 2));
  const [error, setError] = useState('');

  const apply = () => {
    try {
      const value = JSON.parse(text) as unknown;
      xrayDraft.update((c) => {
        if (whole) return path ? setSection(c, path, value) : (value as typeof c);
        return upsertItem(c, path, index, value);
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (!cfg) return <Screen><Muted>…</Muted></Screen>;
  return (
    <Screen>
      <Stack.Screen options={{ title: path || 'Xray' }} />
      <Card>
        <Field label="JSON" value={text} onChange={setText} multiline />
        {!!error && <Text style={{ color: p.error }}>{error}</Text>}
        <Muted>{t('pages.inbounds.advanced.subtitle')}</Muted>
        <Button title={t('pages.xray.geoBrowser.apply')} kind="primary" onPress={apply} />
        {!whole && index >= 0 && (
          <Button
            title={t('delete')}
            kind="danger"
            onPress={() =>
              Alert.alert(t('delete'), t('sure'), [
                { text: t('cancel'), style: 'cancel' },
                {
                  text: t('delete'),
                  style: 'destructive',
                  onPress: () => {
                    xrayDraft.update((c) => removeItem(c, path, index));
                    router.back();
                  },
                },
              ])
            }
          />
        )}
      </Card>
    </Screen>
  );
}

export default function XrayItemRoute() {
  return (
    <RequireSession>
      <ItemScreen />
    </RequireSession>
  );
}
