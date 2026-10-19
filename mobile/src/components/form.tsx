import { Switch, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { Muted } from '@/components/ui';
import { usePalette } from '@/theme';

export function Field({
  label,
  value,
  onChange,
  hint,
  keyboard,
  placeholder,
  multiline,
  secure,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  keyboard?: KeyboardTypeOptions;
  placeholder?: string;
  multiline?: boolean;
  secure?: boolean;
}) {
  const p = usePalette();
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: p.text2 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard}
        placeholder={placeholder}
        placeholderTextColor={p.text3}
        autoCapitalize="none"
        autoCorrect={false}
        multiline={multiline}
        secureTextEntry={secure}
        style={{
          color: p.text,
          backgroundColor: p.surface2,
          borderColor: p.border,
          borderWidth: 1,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: multiline ? 10 : 0,
          minHeight: multiline ? 88 : 44,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
      {!!hint && <Muted>{hint}</Muted>}
    </View>
  );
}

export function SwitchRow({
  label,
  value,
  onChange,
  onText,
  offText,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  onText?: string;
  offText?: string;
  disabled?: boolean;
}) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: p.text2 }}>{label}</Text>
        {(onText || offText) && (
          <Text style={{ color: value ? p.success : p.text3, fontWeight: '600' }}>{value ? onText : offText}</Text>
        )}
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: p.surface2, true: p.success }}
        thumbColor={value ? '#ffffff' : p.text3}
      />
    </View>
  );
}
