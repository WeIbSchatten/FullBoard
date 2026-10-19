import { useRouter } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';

import { AppearancePicker, LanguagePicker } from '@/components/Pickers';
import { Badge, Body, Button, Card, Muted, Screen, Title } from '@/components/ui';
import { useT } from '@/i18n';
import { useSession } from '@/session';

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

export default function More() {
  return (
    <Screen>
      <PanelsCard />
      <LanguagePicker />
      <AppearancePicker />
    </Screen>
  );
}
