import { quotaUsage } from './format';

export type ClientState = 'active' | 'disabled' | 'expired' | 'depleted';

export function clientState(
  client: { enable: boolean; totalGB: number; expiryTime: number },
  traffic: { up: number; down: number } | null | undefined,
  now = Date.now(),
): ClientState {
  if (!client.enable) return 'disabled';
  if (client.expiryTime > 0 && client.expiryTime <= now) return 'expired';
  const usage = quotaUsage(client.totalGB, traffic);
  if (usage.total > 0 && usage.used >= usage.total) return 'depleted';
  return 'active';
}
