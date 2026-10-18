import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Redirect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

import type { Session } from '@/api/client';
import { panelApi, type PanelApi } from '@/api/panel';

const KEY = 'we1ssboard.session';

interface SessionState {
  ready: boolean;
  session: Session | null;
  api: PanelApi | null;
  signIn: (s: Session) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionState | null>(null);

// The API token is a full-admin credential, so it lives only in the OS keystore.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((raw) => setSession(raw ? (JSON.parse(raw) as Session) : null))
      .catch(() => setSession(null))
      .finally(() => setReady(true));
  }, []);

  const signIn = useCallback(async (s: Session) => {
    await SecureStore.setItemAsync(KEY, JSON.stringify(s));
    setSession(s);
  }, []);
  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(KEY);
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ ready, session, api: session ? panelApi(session) : null, signIn, signOut }),
    [ready, session, signIn, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}

export function useApi(): PanelApi {
  const { api } = useSession();
  if (!api) throw new Error('not signed in');
  return api;
}

// Deep links and web reloads can open a signed-in route directly; send them to login first.
export function RequireSession({ children }: { children: ReactNode }) {
  const { session } = useSession();
  if (!session) return <Redirect href="/login" />;
  return children;
}
