import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Platform, Pressable, View } from 'react-native';

import { LOCK_PREF, biometricsAvailable, setLockEnabled } from '@/components/AppLock';
import { SwitchRow } from '@/components/form';
import { MONITOR_PREF, setAlertsEnabled } from '@/monitor';
import { getPref } from '@/prefs';

import { AppearancePicker, LanguagePicker } from '@/components/Pickers';
import { Badge, Body, Button, Card, Muted, Screen, Title } from '@/components/ui';
import { useT } from '@/i18n';
import { SETTING_CATEGORIES } from '@/lib/settingsSchema';
import { useSession } from '@/session';
import { usePalette } from '@/theme';

function PanelSettingsCard() {
  const t = useT();
  const p = usePalette();
  const router = useRouter();
  const items: { label: string; go: () => void }[] = [
    ...SETTING_CATEGORIES.map((c) => ({
      label: t(c.title),
      go: () => router.push({ pathname: '/settings/[category]', params: { category: c.id } }),
    })),
    { label: t('pages.settings.security.admin'), go: () => router.push('/settings/account') },
    { label: t('pages.nodes.apiToken'), go: () => router.push('/settings/tokens') },
    { label: t('pages.index.xrayUpdates'), go: () => router.push('/system') },
    { label: t('pages.index.logs'), go: () => router.push('/logs') },
  ];
  return (
    <Card>
      <Title>{t('menu.settings')}</Title>
      {items.map((it) => (
        <Pressable
          key={it.label}
          onPress={it.go}
          style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: p.border }}
        >
          <Body>{it.label}</Body>
        </Pressable>
      ))}
    </Card>
  );
}

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

function PhoneCard() {
  const t = useT();
  const [alerts, setAlerts] = useState(false);
  const [lock, setLock] = useState(false);
  const [canLock, setCanLock] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => {
    void getPref(MONITOR_PREF).then((v) => setAlerts(v === '1'));
    void getPref(LOCK_PREF).then((v) => setLock(v === '1'));
    void biometricsAvailable().then(setCanLock);
  }, []);
  if (Platform.OS === 'web') return null;
  return (
    <Card>
      <Title>{t('mobile.alerts.title')}</Title>
      <SwitchRow
        label={t('mobile.alerts.enable')}
        value={alerts}
        onChange={(on) =>
          void setAlertsEnabled(on).then((r) => {
            setNote(r === 'denied' ? t('mobile.alerts.denied') : '');
            if (r === 'ok') setAlerts(on);
          })
        }
      />
      <Muted>{note || t('mobile.alerts.hint')}</Muted>
      <SwitchRow
        label={t('mobile.lock.enable')}
        value={lock}
        disabled={!canLock && !lock}
        onChange={(on) => void setLockEnabled(on).then((ok) => ok && setLock(on))}
      />
      {!canLock && <Muted>{t('mobile.lock.unavailable')}</Muted>}
    </Card>
  );
}

export default function More() {
  return (
    <Screen>
      <PanelsCard />
      <PanelSettingsCard />
      <PhoneCard />
      <LanguagePicker />
      <AppearancePicker />
    </Screen>
  );
}
