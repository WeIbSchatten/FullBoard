import { formFromRecord, recordFromForm, type ClientFormRecord } from './clientForm';

const now = Date.UTC(2026, 9, 19, 12);
const DAY = 86_400_000;
const GB = 1024 ** 3;

const record: ClientFormRecord = {
  id: 7,
  email: 'alice',
  enable: true,
  comment: 'family',
  group: 'eu',
  subId: 'sub-a',
  tgId: 0,
  totalGB: 100 * GB,
  expiryTime: now + 29.4 * DAY,
  limitIp: 2,
  limitHwid: 0,
  trafficReset: 'never',
  trafficResetDay: 1,
  uuid: 'keep-me',
  flow: 'xtls-rprx-vision',
};

describe('client form', () => {
  // /clients/update replaces the whole row, so untouched fields must survive exactly.
  it('round-trips an untouched record without drifting the expiry', () => {
    const form = formFromRecord(record, now);
    expect(recordFromForm(record, form, now)).toEqual(record);
  });

  it('converts GB and day counts back into bytes and timestamps', () => {
    const form = { ...formFromRecord(record, now), totalGB: '50', expiryDays: '45', limitIp: '' };
    const out = recordFromForm(record, form, now);
    expect(out.totalGB).toBe(50 * GB);
    expect(out.expiryTime).toBe(now + 45 * DAY);
    expect(out.limitIp).toBe(0);
    expect(out.uuid).toBe('keep-me');
  });

  it.each([
    ['never', '30', 0],
    ['afterFirstUse', '7', -7 * DAY],
  ] as const)('expiry mode %s with %s days', (mode, days, want) => {
    const form = { ...formFromRecord(record, now), expiryMode: mode, expiryDays: days };
    expect(recordFromForm(record, form, now).expiryTime).toBe(want);
  });

  it('reads a delayed-start client back as days after first use', () => {
    const form = formFromRecord({ ...record, expiryTime: -10 * DAY }, now);
    expect(form).toMatchObject({ expiryMode: 'afterFirstUse', expiryDays: '10' });
  });

  it.each([
    [{ email: ' ' }, 'email'],
    [{ totalGB: '-1' }, 'totalGB'],
    [{ tgId: 'abc' }, 'tgId'],
    [{ expiryMode: 'date' as const, expiryDays: '0' }, 'expiryDays'],
  ])('rejects %j naming the field', (patch, field) => {
    const form = { ...formFromRecord(record, now), ...patch };
    expect(() => recordFromForm(record, form, now)).toThrow(field);
  });
});
