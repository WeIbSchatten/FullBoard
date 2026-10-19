export interface Panel {
  id: string;
  name: string;
  baseUrl: string;
  token: string;
}

export interface PanelsState {
  panels: Panel[];
  activeId: string | null;
}

export const EMPTY_PANELS: PanelsState = { panels: [], activeId: null };

function hostOf(baseUrl: string): string {
  return baseUrl.replace(/^https?:\/\//, '').split(/[/:]/)[0];
}

export function newPanelId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function addPanel(
  s: PanelsState,
  input: { baseUrl: string; token: string; name: string },
  id: string,
): PanelsState {
  const name = input.name.trim();
  const existing = s.panels.find((p) => p.baseUrl === input.baseUrl);
  if (existing) {
    const updated = { ...existing, token: input.token, name: name || existing.name };
    return { panels: s.panels.map((p) => (p.id === existing.id ? updated : p)), activeId: existing.id };
  }
  const panel = { id, name: name || hostOf(input.baseUrl), baseUrl: input.baseUrl, token: input.token };
  return { panels: [...s.panels, panel], activeId: id };
}

export function removePanel(s: PanelsState, id: string): PanelsState {
  const panels = s.panels.filter((p) => p.id !== id);
  const activeId = s.activeId === id ? (panels[0]?.id ?? null) : s.activeId;
  return { panels, activeId };
}

// The first app version stored a single {baseUrl, token} under another key.
export function parseStored(raw: string | null, legacy: string | null): PanelsState {
  if (raw) {
    try {
      const s = JSON.parse(raw) as PanelsState;
      if (Array.isArray(s.panels)) return s;
    } catch {
      // fall through to the legacy session
    }
  }
  if (legacy) {
    try {
      const old = JSON.parse(legacy) as { baseUrl: string; token: string };
      if (old.baseUrl && old.token) return addPanel(EMPTY_PANELS, { ...old, name: '' }, newPanelId());
    } catch {
      // unreadable legacy data is dropped
    }
  }
  return EMPTY_PANELS;
}

export const PANELS_PREF = 'we1ssboard.panels';
export const LEGACY_PANELS_PREF = 'we1ssboard.session';
