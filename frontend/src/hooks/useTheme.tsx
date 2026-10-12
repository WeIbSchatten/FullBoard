import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { theme as antdTheme } from 'antd';
import type { ThemeConfig } from 'antd';

const STORAGE_DARK = 'dark-mode';
const STORAGE_ULTRA = 'isUltraDarkThemeEnabled';

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
  const root = document.documentElement.style;
  if (isDark) {
    root.setProperty('--fb-bg', isUltra ? '#000000' : '#0b0c10');
    root.setProperty('--fb-card', isUltra ? '#0c0c0f' : '#13151c');
    root.setProperty('--fb-border', isUltra ? '#16161c' : '#1f2330');
    root.setProperty('--fb-accent', '#f4eee2');
    root.setProperty('--fb-accent-text', '#13151c');
    root.setProperty('--fb-muted', '#8c92a4');
  } else {
    root.setProperty('--fb-bg', '#eef0f5');
    root.setProperty('--fb-card', '#ffffff');
    root.setProperty('--fb-border', 'rgba(15, 23, 42, 0.08)');
    root.setProperty('--fb-accent', '#13151c');
    root.setProperty('--fb-accent-text', '#f4eee2');
    root.setProperty('--fb-muted', '#64748b');
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
applyDom(initialDark, initialUltra);

const DARK_TOKENS = {
  colorBgBase: '#0b0c10',
  colorBgLayout: '#0b0c10',
  colorBgContainer: 'rgba(19, 21, 28, 0.92)',
  colorBgElevated: '#13151c',
  colorPrimary: '#60a5fa',
  colorPrimaryHover: '#93c5fd',
  colorPrimaryActive: '#3b82f6',
  borderRadius: 14,
  borderRadiusLG: 14,
  fontFamily: `"Segoe UI Variable Text", "Segoe UI", "Avenir Next", "Helvetica Neue", sans-serif`,
};
const ULTRA_DARK_TOKENS = {
  colorBgBase: '#000',
  colorBgLayout: '#000',
  colorBgContainer: 'rgba(12, 12, 15, 0.78)',
  colorBgElevated: '#141418',
  colorPrimary: '#60a5fa',
  colorPrimaryHover: '#93c5fd',
  colorPrimaryActive: '#3b82f6',
  borderRadius: 14,
  borderRadiusLG: 20,
  fontFamily: `"Segoe UI Variable Text", "Segoe UI", "Avenir Next", "Helvetica Neue", sans-serif`,
};
const DARK_LAYOUT_TOKENS = {
  bodyBg: 'transparent',
  headerBg: 'transparent',
  headerColor: '#ffffff',
  footerBg: 'transparent',
  siderBg: 'transparent',
  triggerBg: '#141418',
  triggerColor: '#ffffff',
};
const ULTRA_DARK_LAYOUT_TOKENS = {
  bodyBg: 'transparent',
  headerBg: 'transparent',
  headerColor: '#ffffff',
  footerBg: 'transparent',
  siderBg: 'transparent',
  triggerBg: '#0c0c0f',
  triggerColor: '#ffffff',
};
const DARK_MENU_TOKENS = {
  darkItemBg: 'transparent',
  darkSubMenuItemBg: 'transparent',
  darkPopupBg: '#1c1c22',
  itemBorderRadius: 12,
  itemMarginInline: 8,
  itemMarginBlock: 2,
};
const ULTRA_DARK_MENU_TOKENS = {
  darkItemBg: 'transparent',
  darkSubMenuItemBg: 'transparent',
  darkPopupBg: '#141418',
  itemBorderRadius: 12,
  itemMarginInline: 8,
  itemMarginBlock: 2,
};
const DARK_CARD_TOKENS = {
  colorBorderSecondary: 'rgba(255, 255, 255, 0.06)',
  borderRadiusLG: 14,
};
const ULTRA_DARK_CARD_TOKENS = {
  colorBorderSecondary: 'rgba(255, 255, 255, 0.04)',
  borderRadiusLG: 14,
};
const STATISTIC_TOKENS = {
  contentFontSize: 17,
  titleFontSize: 11,
};
const LIGHT_CONTRAST_TOKENS = {
  colorTextDescription: 'rgba(0, 0, 0, 0.58)',
  colorTextTertiary: 'rgba(0, 0, 0, 0.58)',
  colorTextPlaceholder: '#767676',
  colorError: '#cf1322',
  colorErrorText: '#cf1322',
  colorSuccessText: '#237804',
};
const LIGHT_BUTTON_TOKENS = {
  colorPrimary: '#0958d9',
  colorPrimaryHover: '#2468e5',
  colorPrimaryActive: '#073ea8',
};

// hashed:false drops the `:where(.css-<hash>)` wrapper antd puts around every
// rule. It costs nothing in specificity — `:where()` contributes zero, so the
// panel's own `.ant-*` overrides still win — and it removes roughly 5,700
// wrappers, 16% of the generated stylesheet, from what the browser has to parse.
//
// cssVar.key pins the CSS-variable scope. Every panel page mounts its own
// ConfigProvider (there is no root one), and without a fixed key each mints a
// fresh useId-derived scope, so navigating re-serialises and re-injects the whole
// token block under a new class instead of reusing the one already in the head.
const SHARED_STYLE_CONFIG = {
  hashed: false,
  cssVar: { key: 'xui' },
} as const;

export function buildAntdThemeConfig(isDark: boolean, isUltra: boolean): ThemeConfig {
  if (!isDark) {
    return {
      ...SHARED_STYLE_CONFIG,
      algorithm: antdTheme.defaultAlgorithm,
      token: {
        ...LIGHT_CONTRAST_TOKENS,
        borderRadius: 14,
        borderRadiusLG: 14,
        fontFamily: `"Segoe UI Variable Text", "Segoe UI", "Avenir Next", "Helvetica Neue", sans-serif`,
      },
      components: {
        Statistic: STATISTIC_TOKENS,
        Button: LIGHT_BUTTON_TOKENS,
        Card: { borderRadiusLG: 14 },
        Layout: {
          bodyBg: 'transparent',
          headerBg: 'transparent',
          siderBg: 'transparent',
          footerBg: 'transparent',
        },
        Menu: {
          itemBorderRadius: 12,
          itemMarginInline: 8,
          itemMarginBlock: 2,
        },
      },
    };
  }
  return {
    ...SHARED_STYLE_CONFIG,
    algorithm: antdTheme.darkAlgorithm,
    token: isUltra ? ULTRA_DARK_TOKENS : DARK_TOKENS,
    components: {
      Layout: isUltra ? ULTRA_DARK_LAYOUT_TOKENS : DARK_LAYOUT_TOKENS,
      Menu: isUltra ? ULTRA_DARK_MENU_TOKENS : DARK_MENU_TOKENS,
      Card: isUltra ? ULTRA_DARK_CARD_TOKENS : DARK_CARD_TOKENS,
      Statistic: STATISTIC_TOKENS,
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

interface ThemeContextValue {
  isDark: boolean;
  isUltra: boolean;
  toggleTheme: () => void;
  toggleUltra: () => void;
  antdThemeConfig: ThemeConfig;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState<boolean>(initialDark);
  const [isUltra, setIsUltra] = useState<boolean>(initialUltra);

  useLayoutEffect(() => {
    applyDom(isDark, isUltra);
    localStorage.setItem(STORAGE_DARK, String(isDark));
    localStorage.setItem(STORAGE_ULTRA, String(isUltra));
  }, [isDark, isUltra]);

  const toggleTheme = useCallback(() => setIsDark((v) => !v), []);
  const toggleUltra = useCallback(() => setIsUltra((v) => !v), []);

  const antdThemeConfig = useMemo(() => buildAntdThemeConfig(isDark, isUltra), [isDark, isUltra]);

  const value = useMemo<ThemeContextValue>(
    () => ({ isDark, isUltra, toggleTheme, toggleUltra, antdThemeConfig }),
    [isDark, isUltra, toggleTheme, toggleUltra, antdThemeConfig],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
