import { describeExpiry } from '@/lib/format';
import type { ClientState } from '@/lib/clientState';

type T = (key: string, vars?: Record<string, string | number>) => string;

export function expiryLabel(t: T, expiryTime: number): string {
  const e = describeExpiry(expiryTime);
  switch (e.kind) {
    case 'never':
      return t('indefinite');
    case 'expired':
      return t('subscription.expired');
    case 'left':
      return `${t('subscription.daysLeft')}: ${e.days}`;
    case 'afterFirstUse':
      return `${t('pages.clients.delayedStart')}: ${e.days}`;
  }
}

export function clientStateLabel(t: T, state: ClientState): string {
  switch (state) {
    case 'active':
      return t('subscription.active');
    case 'disabled':
      return t('disabled');
    case 'expired':
      return t('subscription.expired');
    case 'depleted':
      return t('depleted');
  }
}

export const CLIENT_STATE_TONE = {
  active: 'success',
  disabled: 'muted',
  expired: 'error',
  depleted: 'warning',
} as const;
