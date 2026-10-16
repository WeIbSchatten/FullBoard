import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface MobileNavValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const MobileNavContext = createContext<MobileNavValue>({ open: false, setOpen: () => {} });

export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return <MobileNavContext.Provider value={value}>{children}</MobileNavContext.Provider>;
}

export function useMobileNav(): MobileNavValue {
  return useContext(MobileNavContext);
}
