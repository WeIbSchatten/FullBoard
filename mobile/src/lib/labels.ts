import { fill, t } from '@/i18n';
import { describeExpiry } from '@/lib/format';

export function expiryLabel(expiryTime: number): string {
  const e = describeExpiry(expiryTime);
  switch (e.kind) {
    case 'never':
      return t.clients.never;
    case 'expired':
      return t.clients.expired;
    case 'left':
      return fill(t.clients.daysLeft, { n: e.days });
    case 'afterFirstUse':
      return fill(t.clients.afterFirstUse, { n: e.days });
  }
}
