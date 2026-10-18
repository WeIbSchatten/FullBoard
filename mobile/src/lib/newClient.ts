import type { NewClient } from '@/api/panel';

export interface NewClientForm {
  email: string;
  totalGB: string;
  days: string;
  limitIp: string;
  comment: string;
}

const GB = 1024 ** 3;
const DAY_MS = 86_400_000;

function nonNegative(field: string, raw: string): number {
  const text = raw.trim();
  if (!text) return 0;
  const n = Number(text.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) throw new Error(`${field}: enter a number ≥ 0`);
  return n;
}

export function buildNewClient(form: NewClientForm, now = Date.now()): NewClient {
  const email = form.email.trim();
  if (!email) throw new Error('email: required');
  const days = nonNegative('days', form.days);
  return {
    email,
    totalGB: Math.round(nonNegative('totalGB', form.totalGB) * GB),
    expiryTime: days > 0 ? now + Math.round(days * DAY_MS) : 0,
    limitIp: Math.floor(nonNegative('limitIp', form.limitIp)),
    comment: form.comment.trim(),
    enable: true,
  };
}

export function randomEmail(): string {
  return Math.random().toString(36).slice(2, 10);
}
