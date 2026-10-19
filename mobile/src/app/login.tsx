import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/BrandMark';
import { LanguagePicker } from '@/components/Pickers';
import { PanelForm } from '@/components/PanelForm';
import { Muted } from '@/components/ui';
import { useT } from '@/i18n';
import { usePalette } from '@/theme';

export default function Login() {
  const p = usePalette();
  const t = useT();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20, gap: 20 }}>
          <View style={{ alignItems: 'center', gap: 12 }}>
            <BrandMark size={64} />
            <Text style={{ color: p.text, fontSize: 24, fontWeight: '700' }}>We1ssBoard</Text>
            <Muted>{t('mobile.login.title')}</Muted>
          </View>
          <PanelForm />
          <LanguagePicker />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
