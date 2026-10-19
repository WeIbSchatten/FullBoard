import { clientState } from './clientState';

const now = Date.UTC(2026, 9, 19);
const DAY = 86_400_000;
const GB = 1024 ** 3;

describe('clientState', () => {
  // The switch alone did not tell an expired or exhausted client from a working one.
  it.each([
    ['active', { enable: true, totalGB: 10 * GB, expiryTime: now + DAY }, { up: 1, down: 1 }],
    ['active', { enable: true, totalGB: 0, expiryTime: 0 }, null],
    ['disabled', { enable: false, totalGB: 0, expiryTime: 0 }, null],
    ['expired', { enable: true, totalGB: 0, expiryTime: now - 1 }, null],
    ['depleted', { enable: true, totalGB: 10 * GB, expiryTime: 0 }, { up: 4 * GB, down: 6 * GB }],
    // Waiting for first use is not expired.
    ['active', { enable: true, totalGB: 0, expiryTime: -7 * DAY }, null],
    // An admin-disabled client reads as disabled even when also expired.
    ['disabled', { enable: false, totalGB: 0, expiryTime: now - 1 }, null],
  ] as const)('%s for %j / %j', (want, client, traffic) => {
    expect(clientState(client, traffic, now)).toBe(want);
  });
});
