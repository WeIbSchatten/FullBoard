import { describeExpiry, formatBytes, quotaUsage } from './format';

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [1023, '1023 B'],
    [1536, '1.5 KB'],
    [53687091200, '50 GB'],
  ])('%i -> %s', (n, want) => expect(formatBytes(n)).toBe(want));
});

describe('describeExpiry', () => {
  const now = Date.UTC(2026, 9, 18, 12);
  const day = 86_400_000;
  it.each([
    [0, { kind: 'never' }],
    [now - day, { kind: 'expired' }],
    [now + 3 * day + 1000, { kind: 'left', days: 3 }],
    // A negative expiry is the panel's "starts on first use" duration.
    [-7 * day, { kind: 'afterFirstUse', days: 7 }],
  ])('%i', (expiry, want) => expect(describeExpiry(expiry, now)).toEqual(want));
});

describe('quotaUsage', () => {
  it('reports used bytes against an unlimited quota without a ratio', () => {
    expect(quotaUsage(0, { up: 10, down: 20 })).toEqual({ used: 30, total: 0, ratio: null });
  });
  it('caps the ratio at 1 when the client is over quota', () => {
    expect(quotaUsage(100, { up: 80, down: 70 })).toEqual({ used: 150, total: 100, ratio: 1 });
  });
  it('treats a missing traffic record as nothing used', () => {
    expect(quotaUsage(100, null)).toEqual({ used: 0, total: 100, ratio: 0 });
  });
});
