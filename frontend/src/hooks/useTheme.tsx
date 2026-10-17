import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { theme as antdTheme } from 'antd';
import type { ThemeConfig } from 'antd';
import type { MappingAlgorithm } from 'antd/es/theme/interface';

const STORAGE_DARK = 'dark-mode';
const STORAGE_ULTRA = 'isUltraDarkThemeEnabled';
const STORAGE_STYLE = 'fb-style';
const STORAGE_SCALE = 'fb-ui-scale';

export type StylePreset = 'mono' | 'pastel';
export const STYLE_PRESETS: StylePreset[] = ['mono', 'pastel'];
export type UiScale = 'auto' | '90' | '100' | '110' | '125' | '150';
export const UI_SCALES: UiScale[] = ['auto', '90', '100', '110', '125', '150'];

function readChoice<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const raw = localStorage.getItem(key);
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}

// Panel px sizes were tuned for ~1440px windows; wide monitors at 100% OS
// scaling get a proportional zoom instead of a sea of empty space.
export function autoUiScale(windowWidth: number): number {
  if (windowWidth < 1800) return 1;
  if (windowWidth < 2300) return 1.1;
  if (windowWidth < 3000) return 1.25;
  return 1.5;
}

export function resolveUiScale(scale: UiScale, windowWidth: number): number {
  return scale === 'auto' ? autoUiScale(windowWidth) : Number(scale) / 100;
}

// Current document zoom; canvas code divides pointer offsets by it.
export function uiZoom(): number {
  return parseFloat(document.documentElement.style.zoom) || 1;
}

function applyAppearance(style: StylePreset, scale: UiScale) {
  const root = document.documentElement;
  root.setAttribute('data-style', style);
  const zoom = resolveUiScale(scale, window.innerWidth);
  root.style.zoom = zoom === 1 ? '' : String(zoom);
  // vh/vw ignore zoom, so viewport-sized rules divide by this (see styles).
  root.style.setProperty('--fb-zoom', String(zoom));
}

function readBool(key: string, fallback: boolean): boolean {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  return raw === 'true';
}

function applyDom(isDark: boolean, isUltra: boolean) {
  document.body.classList.remove('dark', 'light');
  document.body.classList.add(isDark ? 'dark' : 'light');
  // Native scrollbars read color-scheme, not the body class.
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  if (isUltra) {
    document.documentElement.setAttribute('data-theme', 'ultra-dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  const msg = document.getElementById('message');
  if (msg) {
    msg.classList.remove('dark', 'light');
    msg.classList.add(isDark ? 'dark' : 'light');
  }
}

// module load so the document is in the right theme before React mounts.
const initialDark = readBool(STORAGE_DARK, true);
const initialUltra = readBool(STORAGE_ULTRA, false);
const initialStyle = readChoice(STORAGE_STYLE, STYLE_PRESETS, 'mono');
const initialScale = readChoice(STORAGE_SCALE, UI_SCALES, 'auto');
applyDom(initialDark, initialUltra);
applyAppearance(initialStyle, initialScale);

// Mirrors styles/theme.css; antd needs literal colours to derive hover/active shades.
interface Palette {
  bg: string;
  surface: string;
  surface2: string;
  elevated: string;
  border: string;
  borderStrong: string;
  text: string;
  text2: string;
  text3: string;
  accent: string;
  accentHover: string;
  accentActive: string;
  onAccent: string;
  accentSoft: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  chart: [string, string, string];
}

const DARK: Palette = {
  bg: '#0a0a0a',
  surface: '#141414',
  surface2: '#1b1b1b',
  elevated: '#1a1a1a',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.14)',
  text: '#f5f5f5',
  text2: '#b4b4b4',
  text3: '#8f8f8f',
  accent: '#f5f5f5',
  accentHover: '#ffffff',
  accentActive: '#d9d9d9',
  onAccent: '#0a0a0a',
  accentSoft: 'rgba(255, 255, 255, 0.08)',
  success: '#7dcea0',
  warning: '#e2b86b',
  error: '#ec7a7a',
  info: '#9db8db',
  chart: ['#f5f5f5', '#9db8db', '#e2b86b'],
};

const ULTRA: Palette = {
  ...DARK,
  bg: '#000000',
  surface: '#0a0a0a',
  surface2: '#111111',
  elevated: '#0f0f0f',
  border: 'rgba(255, 255, 255, 0.07)',
  borderStrong: 'rgba(255, 255, 255, 0.12)',
};

const LIGHT: Palette = {
  bg: '#f3f3f2',
  surface: '#ffffff',
  surface2: '#f4f4f3',
  elevated: '#ffffff',
  border: 'rgba(0, 0, 0, 0.08)',
  borderStrong: 'rgba(0, 0, 0, 0.15)',
  text: '#111111',
  text2: '#4d4d4d',
  text3: '#666666',
  accent: '#111111',
  accentHover: '#2b2b2b',
  accentActive: '#000000',
  onAccent: '#ffffff',
  accentSoft: 'rgba(0, 0, 0, 0.05)',
  success: '#1f7a45',
  warning: '#8a5a10',
  error: '#b3362f',
  info: '#33608f',
  chart: ['#111111', '#33608f', '#8a5a10'],
};

// Pastel: lemon / pink / lilac / navy on near-black graphite or lavender paper.
const PASTEL_DARK: Palette = {
  bg: '#0b0b0d',
  surface: '#19191c',
  surface2: '#222226',
  elevated: '#1f1f23',
  border: 'rgba(255, 255, 255, 0.07)',
  borderStrong: 'rgba(255, 255, 255, 0.13)',
  text: '#f4f3fa',
  text2: '#bdbbcf',
  text3: '#918fa6',
  accent: '#a8a3f6',
  accentHover: '#bcb8f9',
  accentActive: '#938dec',
  onAccent: '#16163a',
  accentSoft: 'rgba(168, 163, 246, 0.14)',
  success: '#8fd8ae',
  warning: '#f8ffa1',
  error: '#ff8fa3',
  info: '#a9c0ff',
  chart: ['#a8a3f6', '#f6d5ee', '#f8ffa1'],
};

const PASTEL_ULTRA: Palette = {
  ...PASTEL_DARK,
  bg: '#000000',
  surface: '#111113',
  surface2: '#18181b',
  elevated: '#151518',
  border: 'rgba(255, 255, 255, 0.07)',
  borderStrong: 'rgba(255, 255, 255, 0.12)',
};

const PASTEL_LIGHT: Palette = {
  bg: '#f4f3fb',
  surface: '#ffffff',
  surface2: '#efeef9',
  elevated: '#ffffff',
  border: 'rgba(36, 49, 107, 0.10)',
  borderStrong: 'rgba(36, 49, 107, 0.18)',
  text: '#16163a',
  text2: '#45456a',
  text3: '#5e5e80',
  accent: '#24316b',
  accentHover: '#2f3e85',
  accentActive: '#1a2452',
  onAccent: '#ffffff',
  accentSoft: 'rgba(168, 163, 246, 0.22)',
  success: '#1f7a45',
  warning: '#7d6a00',
  error: '#b3364f',
  info: '#3a4fb0',
  chart: ['#24316b', '#8b84ee', '#c25a9f'],
};

const FONT_FAMILY = `ui-sans-serif, -apple-system, "Segoe UI Variable Text", "Segoe UI", system-ui, Roboto, "Helvetica Neue", Arial, sans-serif`;
const FONT_FAMILY_CODE = `ui-monospace, "SF Mono", "JetBrains Mono", "Cascadia Code", Menlo, Consolas, monospace`;

// hashed:false drops the `:where(.css-<hash>)` wrapper antd puts around every rule,
// shrinking the generated stylesheet ~16% at zero specificity cost.
// cssVar.key pins the variable scope: every page mounts its own ConfigProvider.
const SHARED_STYLE_CONFIG = {
  hashed: false,
  cssVar: { key: 'xui' },
} as const;

function paletteFor(isDark: boolean, isUltra: boolean, style: StylePreset = 'mono'): Palette {
  if (style === 'pastel') {
    if (!isDark) return PASTEL_LIGHT;
    return isUltra ? PASTEL_ULTRA : PASTEL_DARK;
  }
  if (!isDark) return LIGHT;
  return isUltra ? ULTRA : DARK;
}

const PASTEL_FONT = `"Manrope Variable", ui-sans-serif, system-ui, "Segoe UI", Roboto, Arial, sans-serif`;

// The dark algorithm blends the seed toward the background (white → #d3d3d3);
// pin the primary ramp so the accent stays exactly the palette colour.
function pinPrimary(p: Palette): MappingAlgorithm {
  return (_seed, map) => ({
    ...map!,
    colorPrimary: p.accent,
    colorPrimaryHover: p.accentHover,
    colorPrimaryActive: p.accentActive,
    colorPrimaryText: p.text,
    colorPrimaryTextHover: p.accentHover,
    colorPrimaryTextActive: p.accentActive,
    colorPrimaryBorder: p.borderStrong,
    colorPrimaryBorderHover: p.text2,
    colorPrimaryBg: p.accentSoft,
    colorPrimaryBgHover: p.accentSoft,
  });
}

export function buildAntdThemeConfig(
  isDark: boolean,
  isUltra: boolean,
  style: StylePreset = 'mono',
): ThemeConfig {
  const p = paletteFor(isDark, isUltra, style);
  const pastel = style === 'pastel';
  return {
    ...SHARED_STYLE_CONFIG,
    algorithm: [isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm, pinPrimary(p)],
    token: {
      colorPrimary: p.accent,
      colorInfo: p.info,
      colorSuccess: p.success,
      colorWarning: p.warning,
      colorError: p.error,
      colorLink: p.text,
      colorLinkHover: p.text2,
      colorBgBase: p.bg,
      colorBgLayout: p.bg,
      colorBgContainer: p.surface,
      colorBgElevated: p.elevated,
      colorBgSpotlight: isDark ? '#2a2a2a' : '#111111',
      colorBorder: p.borderStrong,
      colorBorderSecondary: p.border,
      colorSplit: p.border,
      colorText: p.text,
      colorTextSecondary: p.text2,
      colorTextTertiary: p.text3,
      colorTextDescription: p.text3,
      colorTextPlaceholder: p.text3,
      colorFillSecondary: p.accentSoft,
      colorPrimaryBg: p.accentSoft,
      colorPrimaryBgHover: p.accentSoft,
      controlItemBgActive: p.accentSoft,
      controlItemBgActiveHover: p.accentSoft,
      controlOutline: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
      fontFamily: pastel ? PASTEL_FONT : FONT_FAMILY,
      fontFamilyCode: FONT_FAMILY_CODE,
      fontSize: 14,
      borderRadius: pastel ? 12 : 10,
      borderRadiusSM: pastel ? 10 : 8,
      borderRadiusLG: pastel ? 20 : 16,
      borderRadiusXS: 6,
      controlHeight: 36,
      controlHeightSM: 28,
      controlHeightLG: 42,
      boxShadow: 'none',
      boxShadowSecondary: isDark
        ? '0 24px 64px rgba(0, 0, 0, 0.6)'
        : '0 24px 64px rgba(0, 0, 0, 0.14)',
      motionDurationMid: '0.18s',
      wireframe: false,
    },
    components: {
      Layout: {
        bodyBg: 'transparent',
        headerBg: 'transparent',
        siderBg: 'transparent',
        footerBg: 'transparent',
        triggerBg: p.surface2,
        triggerColor: p.text,
      },
      Button: {
        primaryColor: p.onAccent,
        primaryShadow: 'none',
        defaultShadow: 'none',
        dangerShadow: 'none',
        defaultBg: p.surface2,
        defaultBorderColor: p.border,
        defaultHoverBg: p.accentSoft,
        defaultHoverBorderColor: p.borderStrong,
        defaultHoverColor: p.text,
        defaultActiveBg: p.accentSoft,
        defaultActiveBorderColor: p.borderStrong,
        defaultActiveColor: p.text,
        fontWeight: 500,
        paddingInline: 16,
      },
      Card: {
        colorBgContainer: p.surface,
        colorBorderSecondary: p.border,
        headerBg: 'transparent',
        headerFontSize: 15,
        paddingLG: 20,
      },
      Menu: {
        itemBg: 'transparent',
        subMenuItemBg: 'transparent',
        popupBg: p.elevated,
        itemColor: p.text2,
        itemHoverColor: p.text,
        itemHoverBg: p.accentSoft,
        itemSelectedColor: p.text,
        itemSelectedBg: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.07)',
        itemActiveBg: p.accentSoft,
        subMenuItemSelectedColor: p.text,
        horizontalItemSelectedColor: p.text,
        horizontalItemHoverColor: p.text,
        itemBorderRadius: 10,
        itemMarginInline: 8,
        itemMarginBlock: 2,
        itemHeight: 38,
        activeBarBorderWidth: 0,
        iconSize: 16,
      },
      Tabs: {
        itemColor: p.text2,
        itemHoverColor: p.text,
        itemSelectedColor: p.text,
        itemActiveColor: p.text,
        inkBarColor: p.accent,
        titleFontSize: 14,
      },
      Table: {
        headerBg: p.surface2,
        headerColor: p.text3,
        rowHoverBg: p.accentSoft,
        borderColor: p.border,
        headerSplitColor: 'transparent',
        rowSelectedBg: p.accentSoft,
        rowSelectedHoverBg: p.accentSoft,
      },
      Input: {
        activeShadow: `0 0 0 3px ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
        hoverBorderColor: p.borderStrong,
        activeBorderColor: p.text2,
      },
      InputNumber: {
        activeShadow: `0 0 0 3px ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
        hoverBorderColor: p.borderStrong,
        activeBorderColor: p.text2,
      },
      Select: {
        optionSelectedBg: p.accentSoft,
        optionSelectedColor: p.text,
        optionActiveBg: p.accentSoft,
        activeBorderColor: p.text2,
        hoverBorderColor: p.borderStrong,
        activeOutlineColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      },
      Switch: {
        handleBg: isDark ? '#0a0a0a' : '#ffffff',
        colorTextQuaternary: isDark ? '#3a3a3a' : '#cfcfcf',
        colorTextTertiary: isDark ? '#4a4a4a' : '#bdbdbd',
      },
      Checkbox: { colorWhite: p.onAccent },
      Radio: {
        buttonSolidCheckedColor: p.onAccent,
        buttonSolidCheckedBg: p.accent,
        buttonSolidCheckedHoverBg: p.accentHover,
        buttonSolidCheckedActiveBg: p.accentActive,
        colorWhite: p.onAccent,
      },
      Segmented: {
        itemSelectedBg: p.accent,
        itemSelectedColor: p.onAccent,
        trackBg: p.surface2,
        itemColor: p.text2,
        itemHoverColor: p.text,
        itemHoverBg: p.accentSoft,
      },
      Statistic: { contentFontSize: 22, titleFontSize: 12 },
      Tag: { defaultBg: p.accentSoft, defaultColor: p.text2 },
      Badge: { colorTextLightSolid: p.onAccent },
      Progress: { defaultColor: p.accent, remainingColor: p.accentSoft },
      Slider: {
        handleColor: p.accent,
        trackBg: p.accent,
        trackHoverBg: p.accentHover,
        handleActiveColor: p.accent,
        dotActiveBorderColor: p.accent,
      },
      Pagination: { itemActiveBg: p.accentSoft, itemActiveColor: p.text },
      Steps: { colorTextLightSolid: p.onAccent },
      Modal: { contentBg: p.elevated, headerBg: 'transparent', footerBg: 'transparent' },
      Drawer: { colorBgElevated: p.elevated },
      Tooltip: { colorTextLightSolid: '#f5f5f5' },
      Alert: { withDescriptionPadding: '14px 18px' },
      Collapse: { headerBg: 'transparent', contentBg: 'transparent' },
      Descriptions: { labelBg: p.surface2 },
      FloatButton: { colorPrimary: p.accent, colorTextLightSolid: p.onAccent },
      Message: { contentBg: p.elevated },
      Notification: { colorBgElevated: p.elevated },
    },
  };
}

export function pauseAnimationsUntilLeave(elementId: string): void {
  document.documentElement.setAttribute('data-theme-animations', 'off');
  const el = document.getElementById(elementId);
  if (!el) return;
  const restore = () => {
    document.documentElement.removeAttribute('data-theme-animations');
    el.removeEventListener('mouseleave', restore);
    el.removeEventListener('touchend', restore);
  };
  el.addEventListener('mouseleave', restore);
  el.addEventListener('touchend', restore);
}

export type ThemeMode = 'light' | 'dark' | 'amoled';

interface ThemeContextValue {
  isDark: boolean;
  isUltra: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  stylePreset: StylePreset;
  setStylePreset: (style: StylePreset) => void;
  uiScale: UiScale;
  setUiScale: (scale: UiScale) => void;
  toggleTheme: () => void;
  toggleUltra: () => void;
  antdThemeConfig: ThemeConfig;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState<boolean>(initialDark);
  const [isUltra, setIsUltra] = useState<boolean>(initialUltra);
  const [stylePreset, setStylePreset] = useState<StylePreset>(initialStyle);
  const [uiScale, setUiScale] = useState<UiScale>(initialScale);

  useLayoutEffect(() => {
    applyDom(isDark, isUltra);
    localStorage.setItem(STORAGE_DARK, String(isDark));
    localStorage.setItem(STORAGE_ULTRA, String(isUltra));
  }, [isDark, isUltra]);

  useLayoutEffect(() => {
    applyAppearance(stylePreset, uiScale);
    localStorage.setItem(STORAGE_STYLE, stylePreset);
    localStorage.setItem(STORAGE_SCALE, uiScale);
    if (uiScale !== 'auto') return;
    const onResize = () => applyAppearance(stylePreset, uiScale);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [stylePreset, uiScale]);

  const toggleTheme = useCallback(() => setIsDark((v) => !v), []);
  const toggleUltra = useCallback(() => setIsUltra((v) => !v), []);
  const setMode = useCallback((next: ThemeMode) => {
    setIsDark(next !== 'light');
    setIsUltra(next === 'amoled');
  }, []);
  const mode: ThemeMode = !isDark ? 'light' : isUltra ? 'amoled' : 'dark';

  const antdThemeConfig = useMemo(
    () => buildAntdThemeConfig(isDark, isUltra, stylePreset),
    [isDark, isUltra, stylePreset],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      isDark,
      isUltra,
      mode,
      setMode,
      stylePreset,
      setStylePreset,
      uiScale,
      setUiScale,
      toggleTheme,
      toggleUltra,
      antdThemeConfig,
    }),
    [
      isDark,
      isUltra,
      mode,
      setMode,
      stylePreset,
      uiScale,
      toggleTheme,
      toggleUltra,
      antdThemeConfig,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

export interface ChartColors {
  series: [string, string, string];
  muted: string;
}

// Canvas charts cannot read CSS variables, so hand them literal palette values.
export function useChartColors(): ChartColors {
  const { isDark, isUltra, stylePreset } = useTheme();
  return useMemo(() => {
    const p = paletteFor(isDark, isUltra, stylePreset);
    return { series: p.chart, muted: p.text3 };
  }, [isDark, isUltra, stylePreset]);
}
