/** Nav keys that can be hidden from the sidebar / command palette. */
export const HIDEABLE_NAV_KEYS = [
  '/',
  '/connections',
  '/clients',
  '/groups',
  '/nodes',
  '/hosts',
  '/settings',
  '/xray',
  '/routing',
  '/api-docs',
] as const;

export type HideableNavKey = (typeof HIDEABLE_NAV_KEYS)[number];

export type NavVisibility = {
  /** Keys listed here are omitted from the sidebar (except logout). */
  hidden: string[];
  /** Routing stays off unless explicitly enabled. */
  showRouting: boolean;
};

export const DEFAULT_NAV_VISIBILITY: NavVisibility = {
  hidden: [],
  showRouting: false,
};

export function parseNavVisibility(raw: unknown): NavVisibility {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_NAV_VISIBILITY };
  const obj = raw as Record<string, unknown>;
  const hidden = Array.isArray(obj.hidden)
    ? obj.hidden.filter((k): k is string => typeof k === 'string')
    : [];
  return {
    hidden,
    showRouting: obj.showRouting === true,
  };
}

export function isNavKeyVisible(key: string, vis: NavVisibility): boolean {
  if (key === '/routing') return vis.showRouting && !vis.hidden.includes('/routing');
  const base = key.split('#')[0] || key;
  return !vis.hidden.includes(base) && !vis.hidden.includes(key);
}
