import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Loading } from '@/components/ui';
import { I18nProvider, useT } from '@/i18n';
import { SessionProvider, useSession } from '@/session';
import { ThemeProvider, useTheme } from '@/theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 5_000 } },
});

function Gate() {
  const { ready, session } = useSession();
  const { palette: p, isDark } = useTheme();
  const t = useT();

  if (!ready) return <Loading />;
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: p.bg },
          headerTintColor: p.text,
          contentStyle: { backgroundColor: p.bg },
        }}
      >
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'We1ssBoard' }} />
          <Stack.Screen name="client/[email]" options={{ title: '' }} />
          <Stack.Screen name="client/new" options={{ title: t('pages.clients.addClient'), presentation: 'modal' }} />
          <Stack.Screen name="client/edit/[email]" options={{ title: '' }} />
          <Stack.Screen name="inbound/[id]" options={{ title: '' }} />
          <Stack.Screen name="inbound/edit" options={{ title: '' }} />
          <Stack.Screen name="xray/item" options={{ title: '' }} />
          <Stack.Screen name="webproxy/profile" options={{ title: '' }} />
          <Stack.Screen name="groups" options={{ title: t('menu.groups') }} />
          <Stack.Screen name="panel/add" options={{ title: t('mobile.panels.add'), presentation: 'modal' }} />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <ThemeProvider>
            <SessionProvider>
              <Gate />
            </SessionProvider>
          </ThemeProvider>
        </I18nProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
