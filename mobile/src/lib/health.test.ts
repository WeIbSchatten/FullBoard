import { hasKey } from '@/i18n/translate';

import { healthAlerts, type HealthSnapshot } from './health';

const snap = (xray: string, nodes: Record<string, [string, boolean]> = {}): HealthSnapshot => ({
  xrayRunning: xray === 'running',
  nodes: Object.fromEntries(Object.entries(nodes).map(([id, [name, online]]) => [id, { name, online }])),
});

describe('healthAlerts', () => {
  it('stays quiet on the first check, so installing the app does not fire stale alerts', () => {
    expect(healthAlerts(undefined, snap('stop', { 1: ['de', false] }))).toEqual([]);
  });

  it('reports Xray stopping and recovering once per transition', () => {
    expect(healthAlerts(snap('running'), snap('error'))).toEqual([{ kind: 'xrayDown' }]);
    expect(healthAlerts(snap('error'), snap('error'))).toEqual([]);
    expect(healthAlerts(snap('error'), snap('running'))).toEqual([{ kind: 'xrayUp' }]);
  });

  it('reports nodes going offline and coming back by name', () => {
    const before = snap('running', { 1: ['de', true], 2: ['nl', false] });
    const after = snap('running', { 1: ['de', false], 2: ['nl', true] });
    expect(healthAlerts(before, after)).toEqual([
      { kind: 'nodeDown', node: 'de' },
      { kind: 'nodeUp', node: 'nl' },
    ]);
  });

  it('ignores nodes that were just added or removed', () => {
    expect(healthAlerts(snap('running', { 1: ['de', true] }), snap('running', { 2: ['nl', false] }))).toEqual([]);
  });
});

describe('alert texts', () => {
  it('has a translated message for every alert kind', () => {
    const kinds = ['xrayDown', 'xrayUp', 'nodeDown', 'nodeUp'];
    expect(kinds.filter((k) => !hasKey(`mobile.alerts.${k}`))).toEqual([]);
  });
});
