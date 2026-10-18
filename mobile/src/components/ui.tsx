import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { usePalette } from '@/theme';

export function Screen({
  children,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const p = usePalette();
  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: p.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={p.text2} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return (
    <View
      style={[
        { backgroundColor: p.surface, borderColor: p.border, borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const p = usePalette();
  return <Text style={{ color: p.text, fontSize: 16, fontWeight: '600' }}>{children}</Text>;
}

export function Muted({ children, numberOfLines }: { children: ReactNode; numberOfLines?: number }) {
  const p = usePalette();
  return (
    <Text style={{ color: p.text3, fontSize: 13 }} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Body({ children, selectable }: { children: ReactNode; selectable?: boolean }) {
  const p = usePalette();
  return (
    <Text style={{ color: p.text, fontSize: 14 }} selectable={selectable}>
      {children}
    </Text>
  );
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  const p = usePalette();
  return (
    <View style={styles.row}>
      <Text style={{ color: p.text2, fontSize: 14 }}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text style={{ color: p.text, fontSize: 14, fontWeight: '500' }}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

export function Button({
  title,
  onPress,
  kind = 'default',
  disabled,
  busy,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'default' | 'danger';
  disabled?: boolean;
  busy?: boolean;
}) {
  const p = usePalette();
  const bg = kind === 'primary' ? p.accent : p.surface2;
  const fg = kind === 'primary' ? p.onAccent : kind === 'danger' ? p.error : p.text;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: p.border, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontWeight: '600' }}>{title}</Text>}
    </Pressable>
  );
}

export function Badge({ text, tone }: { text: string; tone: 'success' | 'warning' | 'error' | 'muted' }) {
  const p = usePalette();
  const color = tone === 'muted' ? p.text3 : p[tone];
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={{ color, fontSize: 12, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

export function Meter({ ratio }: { ratio: number }) {
  const p = usePalette();
  const color = ratio > 0.9 ? p.error : ratio > 0.75 ? p.warning : p.accent;
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: p.surface2, overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(ratio * 100)}%`, height: 6, backgroundColor: color }} />
    </View>
  );
}

export function Loading() {
  const p = usePalette();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: p.bg, padding: 32 }}>
      <ActivityIndicator color={p.text2} />
    </View>
  );
}

export function ErrorCard({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const p = usePalette();
  return (
    <Card>
      <Text style={{ color: p.error, fontWeight: '600' }}>{t.common.error}</Text>
      <Body>{error instanceof Error ? error.message : String(error)}</Body>
      {onRetry && <Button title={t.common.retry} onPress={onRetry} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  button: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
});
