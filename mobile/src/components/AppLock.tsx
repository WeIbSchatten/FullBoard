import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

import { BrandMark } from '@/components/BrandMark';
import { Button, Title } from '@/components/ui';
import { useT } from '@/i18n';
import { getPref, setPref } from '@/prefs';
import { usePalette } from '@/theme';

export const LOCK_PREF = 'we1ssboard.biometric';
const RELOCK_AFTER_MS = 30_000;

export async function biometricsAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

export async function setLockEnabled(on: boolean): Promise<boolean> {
  if (on) {
    const res = await LocalAuthentication.authenticateAsync();
    if (!res.success) return false;
  }
  await setPref(LOCK_PREF, on ? '1' : null);
  return true;
}

// Covers the whole app until the device owner confirms with biometrics or the device PIN.
export function AppLock({ children }: { children: ReactNode }) {
  const t = useT();
  const p = usePalette();
  const [locked, setLocked] = useState<boolean | null>(Platform.OS === 'web' ? false : null);
  const leftAt = useRef(0);

  const unlock = useCallback(async () => {
    const res = await LocalAuthentication.authenticateAsync({ promptMessage: t('mobile.lock.locked') });
    if (res.success) setLocked(false);
  }, [t]);
  const unlockRef = useRef(unlock);
  useEffect(() => {
    unlockRef.current = unlock;
  }, [unlock]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const lockIfEnabled = (fallback: boolean | null) =>
      getPref(LOCK_PREF).then((v) => {
        if (v === '1') {
          setLocked(true);
          void unlockRef.current();
        } else if (fallback !== null) setLocked(fallback);
      });
    void lockIfEnabled(false);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') leftAt.current = Date.now();
      if (state === 'active' && leftAt.current && Date.now() - leftAt.current > RELOCK_AFTER_MS) {
        void lockIfEnabled(null);
      }
    });
    return () => sub.remove();
  }, []);

  if (locked === false) return children;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 32, backgroundColor: p.bg }}>
      <BrandMark size={72} />
      {locked && (
        <>
          <Title>{t('mobile.lock.locked')}</Title>
          <Button title={t('mobile.lock.unlock')} kind="primary" onPress={() => void unlock()} />
        </>
      )}
    </View>
  );
}
