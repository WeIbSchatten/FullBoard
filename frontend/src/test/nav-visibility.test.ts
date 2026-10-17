import { describe, expect, it } from 'vitest';

import { isNavKeyVisible, parseNavVisibility } from '@/lib/navVisibility';

describe('navVisibility', () => {
  it('honors hidden keys', () => {
    const vis = parseNavVisibility({ hidden: ['/nodes', '/api-docs'] });
    expect(isNavKeyVisible('/nodes', vis)).toBe(false);
    expect(isNavKeyVisible('/clients', vis)).toBe(true);
  });

  it('hides a hub tab link when its hub is hidden', () => {
    const vis = parseNavVisibility({ hidden: ['/connections'], showRouting: true });
    expect(isNavKeyVisible('/connections#routing', vis)).toBe(false);
  });
});
