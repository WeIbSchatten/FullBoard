import { useState } from 'react';
import { Text, TextInput } from 'react-native';

import { normalizeBaseUrl } from '@/api/client';
import { panelApi } from '@/api/panel';
import { Button, Card, Muted } from '@/components/ui';
import { useT } from '@/i18n';
import { useSession } from '@/session';
import { usePalette } from '@/theme';

// Connects with the token first, so a typo never lands in the saved panel list.
export function PanelForm({ onAdded }: { onAdded?: () => void }) {
  const p = usePalette();
  const t = useT();
  const { addPanel } = useSession();
  const [name, setName] = useState('');
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
      await addPanel({ ...session, name });
      onAdded?.();
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
    <Card>
      <Text style={{ color: p.text2 }}>{t('mobile.login.address')}</Text>
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
      <Muted>{t('mobile.login.addressHint')}</Muted>
      <Text style={{ color: p.text2, marginTop: 8 }}>{t('mobile.login.token')}</Text>
      <TextInput
        style={input}
        value={token}
        onChangeText={setToken}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        placeholderTextColor={p.text3}
      />
      <Muted>{t('mobile.login.tokenHint')}</Muted>
      <Text style={{ color: p.text2, marginTop: 8 }}>{t('mobile.login.name')}</Text>
      <TextInput style={input} value={name} onChangeText={setName} placeholderTextColor={p.text3} />
      {!!error && <Text style={{ color: p.error }}>{error}</Text>}
      <Button
        title={t('mobile.login.connect')}
        kind="primary"
        busy={busy}
        disabled={!address.trim() || !token.trim()}
        onPress={() => void connect()}
      />
    </Card>
  );
}
