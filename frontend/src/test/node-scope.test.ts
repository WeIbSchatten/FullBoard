import { describe, expect, it } from 'vitest';

import { inNodeScope, nodeScopeParam, nodeScopeTabs } from '@/components/nodes/nodeScope';

// FR 5: a connected node's inbounds and clients get their own tab instead of being
// mixed (and their traffic summed) into this panel's pages.
describe('nodeScopeTabs', () => {
  it('lists known nodes, then node ids only inbounds still reference', () => {
    const nodes = [
      { id: 2, name: 'Amsterdam', status: 'online' },
      { id: 5, name: '', status: 'offline' },
    ];
    expect(nodeScopeTabs(nodes, [null, 9, 2, undefined, 9])).toEqual([
      { id: 2, name: 'Amsterdam', online: true },
      { id: 5, name: '#5', online: false },
      { id: 9, name: '#9', online: false },
    ]);
  });

  it('has no tabs on a panel without nodes', () => {
    expect(nodeScopeTabs([], [null, undefined])).toEqual([]);
  });
});

describe('inNodeScope', () => {
  it('keeps this panel apart from each node', () => {
    expect(inNodeScope(null, 'local')).toBe(true);
    expect(inNodeScope(undefined, 'local')).toBe(true);
    expect(inNodeScope(3, 'local')).toBe(false);
    expect(inNodeScope(3, 3)).toBe(true);
    expect(inNodeScope(4, 3)).toBe(false);
    expect(inNodeScope(null, 3)).toBe(false);
  });
});

describe('nodeScopeParam', () => {
  it('reads the tab back from the URL and falls back to this panel', () => {
    const tabs = [{ id: 2, name: 'A', online: true }];
    expect(nodeScopeParam('2', tabs)).toBe(2);
    expect(nodeScopeParam('local', tabs)).toBe('local');
    expect(nodeScopeParam(null, tabs)).toBe('local');
    expect(nodeScopeParam('7', tabs)).toBe('local');
    expect(nodeScopeParam('2', [])).toBeUndefined();
  });
});
