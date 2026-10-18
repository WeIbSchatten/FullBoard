const DAY_MS = 86_400_000;
const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

export function formatBytes(n: number): string {
  if (!n || n < 1024) return `${n || 0} B`;
  let i = 0;
  let v = n;
  while (v >= 1024 && i < UNITS.length - 1) {
    v /= 1024;
    i++;
  }
  return `${Number(v.toFixed(v >= 100 ? 0 : 1))} ${UNITS[i]}`;
}

export type Expiry =
  | { kind: 'never' }
  | { kind: 'expired' }
  | { kind: 'left'; days: number }
  | { kind: 'afterFirstUse'; days: number };

// The panel stores "valid N days from first use" as a negative duration.
export function describeExpiry(expiryTime: number, now = Date.now()): Expiry {
  if (expiryTime === 0) return { kind: 'never' };
  if (expiryTime < 0) return { kind: 'afterFirstUse', days: Math.round(-expiryTime / DAY_MS) };
  if (expiryTime <= now) return { kind: 'expired' };
  return { kind: 'left', days: Math.floor((expiryTime - now) / DAY_MS) };
}

export function quotaUsage(
  totalBytes: number,
  traffic: { up: number; down: number } | null | undefined,
): { used: number; total: number; ratio: number | null } {
  const used = (traffic?.up ?? 0) + (traffic?.down ?? 0);
  if (!totalBytes) return { used, total: 0, ratio: null };
  return { used, total: totalBytes, ratio: Math.min(1, used / totalBytes) };
}

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}
