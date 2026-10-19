const GB = 1024 ** 3;
const DAY = 86_400_000;

export const TRAFFIC_RESETS = ['never', 'hourly', 'daily', 'weekly', 'monthly'] as const;
export type TrafficReset = (typeof TRAFFIC_RESETS)[number];
export type ExpiryMode = 'never' | 'date' | 'afterFirstUse';

// The fields the edit screen touches; everything else on the record passes through.
export interface ClientFormRecord {
  email: string;
  enable: boolean;
  comment: string;
  group: string;
  subId: string;
  tgId: number;
  totalGB: number;
  expiryTime: number;
  limitIp: number;
  limitHwid: number;
  trafficReset: string;
  trafficResetDay: number;
  [other: string]: unknown;
}

export interface ClientForm {
  email: string;
  enable: boolean;
  comment: string;
  group: string;
  subId: string;
  tgId: string;
  totalGB: string;
  expiryMode: ExpiryMode;
  expiryDays: string;
  limitIp: string;
  limitHwid: string;
  trafficReset: TrafficReset;
  trafficResetDay: string;
}

const num = (n: number) => (n ? String(Number(n.toFixed(2))) : '');

export function formFromRecord(r: ClientFormRecord, now = Date.now()): ClientForm {
  let expiryMode: ExpiryMode = 'never';
  let expiryDays = '';
  if (r.expiryTime < 0) {
    expiryMode = 'afterFirstUse';
    expiryDays = String(Math.round(-r.expiryTime / DAY));
  } else if (r.expiryTime > 0) {
    expiryMode = 'date';
    expiryDays = String(Math.max(0, Math.ceil((r.expiryTime - now) / DAY)));
  }
  return {
    email: r.email,
    enable: r.enable,
    comment: r.comment ?? '',
    group: r.group ?? '',
    subId: r.subId ?? '',
    tgId: r.tgId ? String(r.tgId) : '',
    totalGB: num(r.totalGB / GB),
    expiryMode,
    expiryDays,
    limitIp: r.limitIp ? String(r.limitIp) : '',
    limitHwid: r.limitHwid ? String(r.limitHwid) : '',
    trafficReset: (TRAFFIC_RESETS as readonly string[]).includes(r.trafficReset)
      ? (r.trafficReset as TrafficReset)
      : 'never',
    trafficResetDay: String(r.trafficResetDay || 1),
  };
}

function number(field: string, raw: string, { integer = false, min = 0 } = {}): number {
  const text = raw.trim().replace(',', '.');
  if (!text) return 0;
  const n = Number(text);
  if (!Number.isFinite(n) || n < min || (integer && !Number.isInteger(n))) {
    throw new Error(`${field}: invalid number`);
  }
  return n;
}

export function recordFromForm<R extends ClientFormRecord>(r: R, f: ClientForm, now = Date.now()): R {
  const email = f.email.trim();
  if (!email) throw new Error('email: required');
  const before = formFromRecord(r, now);

  let expiryTime = r.expiryTime;
  if (f.expiryMode !== before.expiryMode || f.expiryDays !== before.expiryDays) {
    const days = number('expiryDays', f.expiryDays, { integer: true });
    if (f.expiryMode === 'never') expiryTime = 0;
    else if (days <= 0) throw new Error('expiryDays: must be at least 1');
    else expiryTime = f.expiryMode === 'date' ? now + days * DAY : -days * DAY;
  }

  const totalGB =
    f.totalGB === before.totalGB ? r.totalGB : Math.round(number('totalGB', f.totalGB) * GB);
  return {
    ...r,
    email,
    enable: f.enable,
    comment: f.comment.trim(),
    group: f.group.trim(),
    subId: f.subId.trim(),
    tgId: number('tgId', f.tgId, { integer: true }),
    totalGB,
    expiryTime,
    limitIp: number('limitIp', f.limitIp, { integer: true }),
    limitHwid: number('limitHwid', f.limitHwid, { integer: true }),
    trafficReset: f.trafficReset,
    trafficResetDay: number('trafficResetDay', f.trafficResetDay, { integer: true, min: 1 }) || 1,
  };
}
