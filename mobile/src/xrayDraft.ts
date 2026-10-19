import { useSyncExternalStore } from 'react';

import { parseConfig, serializeConfig, type XrayConfig } from '@/lib/xrayConfig';

// One editable copy of the Xray template shared by the connection screens; the
// list screens and the per-item editor all change it, the hub saves it.
interface DraftState {
  base: string | null;
  cfg: XrayConfig | null;
  dirty: boolean;
}

let state: DraftState = { base: null, cfg: null, dirty: false };
const listeners = new Set<() => void>();

function emit(next: DraftState) {
  state = next;
  listeners.forEach((l) => l());
}

export const xrayDraft = {
  load(raw: string) {
    if (state.dirty || state.base === raw) return;
    emit({ base: raw, cfg: parseConfig(raw), dirty: false });
  },
  update(fn: (cfg: XrayConfig) => XrayConfig) {
    if (!state.cfg) return;
    emit({ ...state, cfg: fn(state.cfg), dirty: true });
  },
  saved() {
    if (!state.cfg) return;
    emit({ base: serializeConfig(state.cfg), cfg: state.cfg, dirty: false });
  },
  discard() {
    emit({ base: null, cfg: null, dirty: false });
  },
};

export function useXrayDraft(): DraftState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
