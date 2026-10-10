import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { useAllSettings } from '@/api/queries/useAllSettings';

export type NavPosition = 'side' | 'top';

type NavLayoutValue = {
  navPosition: NavPosition;
  tabsTabPosition: 'top' | 'left';
};

const NavLayoutContext = createContext<NavLayoutValue>({
  navPosition: 'side',
  tabsTabPosition: 'top',
});

export function NavLayoutProvider({ children }: { children: ReactNode }) {
  const { allSetting } = useAllSettings();
  const value = useMemo<NavLayoutValue>(() => {
    const navPosition: NavPosition = allSetting?.navPosition === 'top' ? 'top' : 'side';
    return {
      navPosition,
      tabsTabPosition: navPosition === 'top' ? 'left' : 'top',
    };
  }, [allSetting?.navPosition]);
  return <NavLayoutContext.Provider value={value}>{children}</NavLayoutContext.Provider>;
}

export function useNavLayout(): NavLayoutValue {
  return useContext(NavLayoutContext);
}
