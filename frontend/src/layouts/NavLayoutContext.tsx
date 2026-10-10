import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';

import { useAllSettings } from '@/api/queries/useAllSettings';

export type NavPosition = 'side' | 'top';

type NavLayoutValue = {
  navPosition: NavPosition;
  tabsTabPosition: 'top' | 'left';
  /** True once server settings (or a cached preference) decided the chrome mode. */
  ready: boolean;
};

const NAV_POSITION_KEY = 'fullboard-nav-position';

function readCachedNavPosition(): NavPosition | null {
  try {
    const v = localStorage.getItem(NAV_POSITION_KEY);
    if (v === 'top' || v === 'side') return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeCachedNavPosition(pos: NavPosition) {
  try {
    localStorage.setItem(NAV_POSITION_KEY, pos);
  } catch {
    /* ignore */
  }
}

function resolveNavPosition(raw: string | undefined, cached: NavPosition | null): NavPosition {
  if (raw === 'top' || raw === 'side') return raw;
  return cached ?? 'side';
}

const NavLayoutContext = createContext<NavLayoutValue>({
  navPosition: readCachedNavPosition() ?? 'side',
  tabsTabPosition: (readCachedNavPosition() ?? 'side') === 'top' ? 'left' : 'top',
  ready: readCachedNavPosition() != null,
});

export function NavLayoutProvider({ children }: { children: ReactNode }) {
  const { allSetting, fetched } = useAllSettings();
  const cached = useMemo(() => readCachedNavPosition(), []);

  const value = useMemo<NavLayoutValue>(() => {
    // Prefer the live setting once loaded; until then use the last saved chrome
    // mode so a top-nav operator never flashes the left sider on reload.
    const fromServer = fetched ? allSetting?.navPosition : undefined;
    const navPosition = resolveNavPosition(fromServer, cached);
    return {
      navPosition,
      tabsTabPosition: navPosition === 'top' ? 'left' : 'top',
      ready: fetched || cached != null,
    };
  }, [allSetting?.navPosition, cached, fetched]);

  useEffect(() => {
    if (!fetched) return;
    const pos = allSetting?.navPosition === 'top' ? 'top' : 'side';
    writeCachedNavPosition(pos);
  }, [fetched, allSetting?.navPosition]);

  return <NavLayoutContext.Provider value={value}>{children}</NavLayoutContext.Provider>;
}

export function useNavLayout(): NavLayoutValue {
  return useContext(NavLayoutContext);
}
