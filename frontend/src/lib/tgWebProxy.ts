export const CARRIER_MODES = ['https', 'https-lanes', 'websocket', 'websocket-lanes'] as const;
export type CarrierMode = (typeof CARRIER_MODES)[number];

export const SECRET_PATTERN = /^(dd)?[0-9a-f]{32}$/;
export const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;
export const BASE_PATH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*(\/[A-Za-z0-9][A-Za-z0-9_-]*)*$/;

const LOOPBACK_V4 = /^127\.(\d{1,3})\.(\d{1,3})\.(\d{1,3}):(\d{1,5})$/;
const LOOPBACK_V6 = /^\[::1\]:(\d{1,5})$/;

function validPort(raw: string): boolean {
  const port = Number(raw);
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

// Mirrors the relay: only numeric loopback host:port is accepted for listeners and backends.
export function isLoopbackHostPort(value: string): boolean {
  const v4 = LOOPBACK_V4.exec(value);
  if (v4) return v4.slice(1, 4).every((o) => Number(o) <= 255) && validPort(v4[4]);
  const v6 = LOOPBACK_V6.exec(value);
  return !!v6 && validPort(v6[1]);
}

export function isLoopbackHttpUrl(value: string): boolean {
  const match = /^http:\/\/(.+)$/.exec(value);
  return !!match && isLoopbackHostPort(match[1]);
}

export function generateSecret(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Next free backend port after the highest one already used on 127.0.0.1.
export function nextBackend(backends: string[]): string {
  const ports = backends
    .map((b) => /:(\d+)$/.exec(b)?.[1])
    .filter((p): p is string => !!p)
    .map(Number);
  const next = ports.length ? Math.max(...ports) + 1 : 2398;
  return `127.0.0.1:${next}`;
}
