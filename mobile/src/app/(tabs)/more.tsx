import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';

import { AppearancePicker, LanguagePicker } from '@/components/Pickers';
import { Badge, Body, Button, Card, ErrorCard, Muted, Row, Screen, Title } from '@/components/ui';
import { useT } from '@/i18n';
import { useApi, useSession } from '@/session';

const isManaged = (name: string) => name.startsWith('fb:');

function PanelsCard() {
  const t = useT();
  const router = useRouter();
  const { panels, active, switchPanel, removePanel } = useSession();
  return (
    <Card>
      <Title>{t('mobile.panels.title')}</Title>
      {panels.map((panel) => (
        <Pressable
          key={panel.id}
          onPress={() => void switchPanel(panel.id)}
          onLongPress={() =>
            Alert.alert(panel.name, t('mobile.panels.removeConfirm'), [
              { text: t('cancel'), style: 'cancel' },
              { text: t('mobile.panels.remove'), style: 'destructive', onPress: () => void removePanel(panel.id) },
            ])
          }
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}
        >
          <View style={{ flex: 1 }}>
            <Body>{panel.name}</Body>
            <Muted numberOfLines={1}>{panel.baseUrl}</Muted>
          </View>
          {panel.id === active?.id && <Badge text={t('mobile.panels.current')} tone="success" />}
        </Pressable>
      ))}
      <Button title={t('mobile.panels.add')} onPress={() => router.push('/panel/add')} />
      {active && (
        <Button
          title={t('mobile.panels.remove')}
          kind="danger"
          onPress={() =>
            Alert.alert(active.name, t('mobile.panels.removeConfirm'), [
              { text: t('cancel'), style: 'cancel' },
              { text: t('mobile.panels.remove'), style: 'destructive', onPress: () => void removePanel(active.id) },
            ])
          }
        />
      )}
    </Card>
  );
}

function WebProxyCard() {
  const api = useApi();
  const t = useT();
  const status = useQuery({ queryKey: ['webProxy', 'status'], queryFn: api.webProxyStatus });
  const installed = !!status.data?.binaryInstalled && !!status.data.configExists;
  const config = useQuery({ queryKey: ['webProxy', 'config'], queryFn: api.webProxyConfig, enabled: installed });
  const bindings = useQuery({ queryKey: ['webProxy', 'bindings'], queryFn: api.webProxyBindings, enabled: installed });
  const boundTo = (name: string) =>
    (bindings.data?.bindings ?? []).filter((b) => b.nodeId == null && b.profileName === name).length;

  return (
    <Card>
      <Title>{t('menu.tgWebProxy')}</Title>
      {status.error && <ErrorCard error={status.error} />}
      {status.data && !installed && <Muted>{t('tgbot.messages.webProxyNotInstalled')}</Muted>}
      {installed && (
        <>
          <Row label={t('pages.tgWebProxy.hostname')} value={status.data?.hostname ?? ''} />
          <Muted>{t('pages.tgWebProxy.tabs.profiles')}</Muted>
          {(config.data?.profiles ?? [])
            .filter((pr) => !isManaged(pr.name))
            .map((pr) => (
              <Row
                key={pr.name}
                label={`${pr.name} · ${pr.carrier_mode || 'https'}`}
                value={<Badge text={`${t('clients')}: ${boundTo(pr.name)}`} tone="muted" />}
              />
            ))}
        </>
      )}
    </Card>
  );
}

export default function More() {
  return (
    <Screen>
      <PanelsCard />
      <WebProxyCard />
      <LanguagePicker />
      <AppearancePicker />
    </Screen>
  );
}
