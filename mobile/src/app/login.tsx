import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeBaseUrl } from '@/api/client';
import { panelApi } from '@/api/panel';
import { BrandMark } from '@/components/BrandMark';
import { Button, Card, Muted } from '@/components/ui';
import { t } from '@/i18n';
import { useSession } from '@/session';
import { usePalette } from '@/theme';

export default function Login() {
  const p = usePalette();
  const { signIn } = useSession();
  const [address, setAddress] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const connect = async () => {
    setBusy(true);
    setError('');
    try {
      const session = { baseUrl: normalizeBaseUrl(address), token: token.trim() };
      await panelApi(session).status();
      await signIn(session);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const input = {
    color: p.text,
    backgroundColor: p.surface2,
    borderColor: p.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center', padding: 20, gap: 20 }}
      >
        <View style={{ alignItems: 'center', gap: 12 }}>
          <BrandMark size={64} />
          <Text style={{ color: p.text, fontSize: 24, fontWeight: '700' }}>{t.appName}</Text>
          <Muted>{t.login.title}</Muted>
        </View>
        <Card>
          <Text style={{ color: p.text2 }}>{t.login.address}</Text>
          <TextInput
            style={input}
            value={address}
            onChangeText={setAddress}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="panel.example.com:2053/abc"
            placeholderTextColor={p.text3}
          />
          <Muted>{t.login.addressHint}</Muted>
          <Text style={{ color: p.text2, marginTop: 8 }}>{t.login.token}</Text>
          <TextInput
            style={input}
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            placeholderTextColor={p.text3}
          />
          <Muted>{t.login.tokenHint}</Muted>
          {!!error && <Text style={{ color: p.error }}>{error}</Text>}
          <Button
            title={t.login.connect}
            kind="primary"
            busy={busy}
            disabled={!address.trim() || !token.trim()}
            onPress={() => void connect()}
          />
        </Card>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
