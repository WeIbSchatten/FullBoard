import { describe, expect, it } from 'vitest';

import { DEFAULT_NAV_VISIBILITY, isNavKeyVisible, parseNavVisibility } from '@/lib/navVisibility';

describe('navVisibility', () => {
  it('hides routing by default', () => {
    expect(isNavKeyVisible('/routing', DEFAULT_NAV_VISIBILITY)).toBe(false);
    expect(isNavKeyVisible('/connections', DEFAULT_NAV_VISIBILITY)).toBe(true);
  });

  it('shows routing only when showRouting is true', () => {
    const vis = parseNavVisibility({ showRouting: true, hidden: [] });
    expect(isNavKeyVisible('/routing', vis)).toBe(true);
  });

  it('honors hidden keys for non-routing entries', () => {
    const vis = parseNavVisibility({ hidden: ['/nodes', '/api-docs'] });
    expect(isNavKeyVisible('/nodes', vis)).toBe(false);
    expect(isNavKeyVisible('/clients', vis)).toBe(true);
  });
});
