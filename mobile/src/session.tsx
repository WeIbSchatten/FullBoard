import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';

import type { Session } from '@/api/client';
import { panelApi, type PanelApi } from '@/api/panel';
import {
  EMPTY_PANELS,
  addPanel as addToState,
  newPanelId,
  parseStored,
  removePanel as removeFromState,
  type Panel,
  type PanelsState,
} from '@/panels';
import { getPref, setPref } from '@/prefs';

const KEY = 'we1ssboard.panels';
const LEGACY_KEY = 'we1ssboard.session';

interface SessionState {
  ready: boolean;
  panels: Panel[];
  active: Panel | null;
  session: Session | null;
  api: PanelApi | null;
  addPanel: (input: { baseUrl: string; token: string; name: string }) => Promise<void>;
  removePanel: (id: string) => Promise<void>;
  switchPanel: (id: string) => Promise<void>;
}

const Ctx = createContext<SessionState | null>(null);

// API tokens are full-admin credentials, so the panel list lives only in the OS keystore.
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<PanelsState>(EMPTY_PANELS);

  useEffect(() => {
    Promise.all([getPref(KEY), getPref(LEGACY_KEY)])
      .then(([raw, legacy]) => setState(parseStored(raw, legacy)))
      .catch(() => setState(EMPTY_PANELS))
      .finally(() => setReady(true));
  }, []);

  // Each panel has its own data, so a switch must not show the previous one's cache.
  const commit = useCallback(
    async (next: PanelsState) => {
      if (next.activeId !== state.activeId) queryClient.clear();
      setState(next);
      await setPref(KEY, JSON.stringify(next));
      await setPref(LEGACY_KEY, null);
    },
    [queryClient, state.activeId],
  );

  const addPanel = useCallback(
    (input: { baseUrl: string; token: string; name: string }) => commit(addToState(state, input, newPanelId())),
    [commit, state],
  );
  const removePanel = useCallback((id: string) => commit(removeFromState(state, id)), [commit, state]);
  const switchPanel = useCallback((id: string) => commit({ ...state, activeId: id }), [commit, state]);

  const value = useMemo<SessionState>(() => {
    const active = state.panels.find((p) => p.id === state.activeId) ?? null;
    const session = active ? { baseUrl: active.baseUrl, token: active.token } : null;
    return {
      ready,
      panels: state.panels,
      active,
      session,
      api: session ? panelApi(session) : null,
      addPanel,
      removePanel,
      switchPanel,
    };
  }, [ready, state, addPanel, removePanel, switchPanel]);
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
