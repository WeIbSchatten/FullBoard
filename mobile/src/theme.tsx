import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { PALETTES, STYLE_PRESETS, type Palette, type StylePreset } from '@panel/palettes';

import { getPref, setPref } from '@/prefs';

export { STYLE_PRESETS, type Palette, type StylePreset };

export type ThemeMode = 'system' | 'light' | 'dark' | 'amoled';
export const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark', 'amoled'];

const KEY = 'we1ssboard.theme';

interface ThemeState {
  mode: ThemeMode;
  style: StylePreset;
  palette: Palette;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  setStyle: (style: StylePreset) => void;
}

const Ctx = createContext<ThemeState | null>(null);

// Same palettes as the panel's appearance presets (frontend/src/theme/palettes.ts).
export function paletteFor(style: StylePreset, mode: ThemeMode, systemDark: boolean): Palette {
  const set = PALETTES[style];
  if (mode === 'amoled') return set.ultra;
  if (mode === 'light' || (mode === 'system' && !systemDark)) return set.light;
  return set.dark;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemDark = useColorScheme() !== 'light';
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [style, setStyleState] = useState<StylePreset>('mono');

  useEffect(() => {
    getPref(KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as { mode?: ThemeMode; style?: StylePreset };
        if (saved.mode && THEME_MODES.includes(saved.mode)) setModeState(saved.mode);
        if (saved.style && STYLE_PRESETS.includes(saved.style)) setStyleState(saved.style);
      })
      .catch(() => undefined);
  }, []);

  const persist = useCallback((next: { mode: ThemeMode; style: StylePreset }) => {
    void setPref(KEY, JSON.stringify(next));
  }, []);
  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      persist({ mode: next, style });
    },
    [persist, style],
  );
  const setStyle = useCallback(
    (next: StylePreset) => {
      setStyleState(next);
      persist({ mode, style: next });
    },
    [persist, mode],
  );

  const value = useMemo<ThemeState>(() => {
    const palette = paletteFor(style, mode, systemDark);
    const isDark = mode === 'amoled' || mode === 'dark' || (mode === 'system' && systemDark);
    return { mode, style, palette, isDark, setMode, setStyle };
  }, [mode, style, systemDark, setMode, setStyle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme outside ThemeProvider');
  return v;
}

export function usePalette(): Palette {
  return useTheme().palette;
}
