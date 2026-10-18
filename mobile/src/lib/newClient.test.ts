import { buildNewClient } from './newClient';

const now = Date.UTC(2026, 9, 18);
const GB = 1024 ** 3;

describe('buildNewClient', () => {
  it('turns form text into the panel payload: bytes, absolute expiry, trimmed email', () => {
    const got = buildNewClient(
      { email: '  alice ', totalGB: '50', days: '30', limitIp: '2', comment: 'vip' },
      now,
    );
    expect(got).toEqual({
      email: 'alice',
      totalGB: 50 * GB,
      expiryTime: now + 30 * 86_400_000,
      limitIp: 2,
      comment: 'vip',
      enable: true,
    });
  });

  it('keeps empty or zero limits as unlimited / no expiry', () => {
    const got = buildNewClient({ email: 'bob', totalGB: '', days: '0', limitIp: '', comment: '' }, now);
    expect(got).toMatchObject({ totalGB: 0, expiryTime: 0, limitIp: 0 });
  });

  it.each([
    [{ email: '', totalGB: '1', days: '1', limitIp: '0', comment: '' }, 'email'],
    [{ email: 'x', totalGB: '-1', days: '1', limitIp: '0', comment: '' }, 'totalGB'],
    [{ email: 'x', totalGB: '1', days: 'abc', limitIp: '0', comment: '' }, 'days'],
  ])('rejects %j naming the field', (form, field) => {
    expect(() => buildNewClient(form, now)).toThrow(field);
  });
});
