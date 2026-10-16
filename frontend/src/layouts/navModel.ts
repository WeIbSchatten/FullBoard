export type NavSection = 'main' | 'manage' | 'infra' | 'system';

export interface NavRoute {
  key: string;
  titleKey: string;
  hintKey: string;
  section: NavSection;
}

// Single source for sidebar order, top-bar titles and page hints.
export const NAV_ROUTES: NavRoute[] = [
  { key: '/', titleKey: 'menu.dashboard', hintKey: 'menu.hint.dashboard', section: 'main' },
  {
    key: '/connections',
    titleKey: 'menu.connections',
    hintKey: 'menu.hint.connections',
    section: 'manage',
  },
  { key: '/clients', titleKey: 'menu.clients', hintKey: 'menu.hint.clients', section: 'manage' },
  { key: '/groups', titleKey: 'menu.groups', hintKey: 'menu.hint.groups', section: 'manage' },
  { key: '/nodes', titleKey: 'menu.nodes', hintKey: 'menu.hint.nodes', section: 'infra' },
  { key: '/hosts', titleKey: 'menu.hosts', hintKey: 'menu.hint.hosts', section: 'infra' },
  { key: '/xray', titleKey: 'menu.xray', hintKey: 'menu.hint.xray', section: 'system' },
  { key: '/routing', titleKey: 'menu.routing', hintKey: 'menu.hint.xray', section: 'system' },
  {
    key: '/settings',
    titleKey: 'menu.settings',
    hintKey: 'menu.hint.settings',
    section: 'system',
  },
  { key: '/api-docs', titleKey: 'menu.apiDocs', hintKey: 'menu.hint.apiDocs', section: 'system' },
];

export const NAV_SECTION_TITLE_KEYS: Record<Exclude<NavSection, 'main'>, string> = {
  manage: 'menu.sectionManage',
  infra: 'menu.sectionInfra',
  system: 'menu.sectionSystem',
};

// Legacy deep links (/inbounds, /outbound, /tg-web-proxy) redirect into Connections.
const ROUTE_ALIASES: Record<string, string> = {
  '/inbounds': '/connections',
  '/outbound': '/connections',
  '/tg-web-proxy': '/connections',
};

export function routeForPath(pathname: string): NavRoute {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const target = ROUTE_ALIASES[clean] ?? clean;
  return NAV_ROUTES.find((r) => r.key === target) ?? NAV_ROUTES[0];
}
