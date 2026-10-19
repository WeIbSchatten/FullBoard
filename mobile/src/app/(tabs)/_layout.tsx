import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { useT } from '@/i18n';
import { RequireSession } from '@/session';
import { usePalette } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size }: { name: IconName; color: ColorValue | null; size: number }) {
  // Tabs hand over any ColorValue; Ionicons accepts only a string or native colour.
  const tint = typeof color === 'number' || color == null ? undefined : color;
  return <Ionicons name={name} color={tint} size={size} />;
}

const icon = (name: IconName) => {
  const render = (props: { color: ColorValue | null; size: number }) => <TabIcon name={name} {...props} />;
  render.displayName = `TabIcon(${name})`;
  return render;
};

export default function TabsLayout() {
  const p = usePalette();
  const t = useT();
  return (
    <RequireSession>
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: p.bg },
        headerTintColor: p.text,
        tabBarStyle: { backgroundColor: p.surface, borderTopColor: p.border },
        tabBarActiveTintColor: p.text,
        tabBarInactiveTintColor: p.text3,
        sceneStyle: { backgroundColor: p.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('menu.dashboard'), tabBarIcon: icon('speedometer-outline') }} />
      <Tabs.Screen name="clients" options={{ title: t('menu.clients'), tabBarIcon: icon('people-outline') }} />
      <Tabs.Screen name="inbounds" options={{ title: t('menu.inbounds'), tabBarIcon: icon('git-network-outline') }} />
      <Tabs.Screen name="nodes" options={{ title: t('menu.nodes'), tabBarIcon: icon('server-outline') }} />
      <Tabs.Screen name="more" options={{ title: t('menu.settings'), tabBarIcon: icon('settings-outline') }} />
    </Tabs>
    </RequireSession>
  );
}
