import type { WireInboundPayload } from '@/lib/xray/inbound-form-adapter';
import { buildChainRule, type ChainRoutingRule } from '@/pages/xray/outbounds/cross-server-chain';
import type { XraySettingsValue } from '@/hooks/useXraySetting';

export interface BackendEndpoint {
  host: string;
  port: number;
}

export function parseBackendHostPort(backend: string): BackendEndpoint | null {
  const trimmed = backend.trim();
  if (!trimmed) return null;
  const v6 = trimmed.match(/^\[([^\]]+)\]:(\d+)$/);
  if (v6) {
    const port = Number(v6[2]);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
    return { host: v6[1], port };
  }
  const idx = trimmed.lastIndexOf(':');
  if (idx <= 0) return null;
  const host = trimmed.slice(0, idx);
  const port = Number(trimmed.slice(idx + 1));
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { host, port };
}

export function sanitizeProfileTagSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'profile'
  );
}

export function pickLoopbackListenPort(used: Iterable<number>): number {
  const taken = new Set(used);
  for (let i = 0; i < 64; i++) {
    const port = 31000 + Math.floor(Math.random() * 10000);
    if (!taken.has(port)) return port;
  }
  for (let port = 31000; port < 41000; port++) {
    if (!taken.has(port)) return port;
  }
  throw new Error('no free loopback port in 31000-40999');
}

export function buildTproxyTunnelInbound(input: {
  profileName: string;
  listenPort: number;
  rewrite: BackendEndpoint;
}): WireInboundPayload {
  const slug = sanitizeProfileTagSlug(input.profileName);
  const tag = `tproxy-backend-${slug}`;
  return {
    up: 0,
    down: 0,
    total: 0,
    remark: `tproxy backend ${input.profileName}`,
    enable: true,
    expiryTime: 0,
    trafficReset: 'never',
    trafficResetDay: 1,
    lastTrafficResetTime: 0,
    listen: '127.0.0.1',
    port: input.listenPort,
    protocol: 'tunnel',
    settings: JSON.stringify({
      rewriteAddress: input.rewrite.host,
      rewritePort: input.rewrite.port,
      portMap: {},
      allowedNetwork: 'tcp',
      followRedirect: false,
    }),
    streamSettings: JSON.stringify({ security: 'none' }),
    sniffing: JSON.stringify({ enabled: false }),
    tag,
    shareAddrStrategy: 'node',
    shareAddr: '',
    subSortIndex: 1,
    excludeFromSub: true,
    disableFlow: false,
  };
}

export function buildTproxyBackendRule(
  inboundTag: string,
  outboundTag: string,
): ChainRoutingRule | null {
  return buildChainRule({
    outboundTag,
    inboundTags: [inboundTag],
    domains: [],
    ips: [],
    allTraffic: false,
  });
}

export function applyTproxyBackendRule(
  template: XraySettingsValue,
  rule: ChainRoutingRule,
  position: 'top' | 'bottom' = 'top',
): void {
  if (!template.routing) template.routing = {};
  const rules = (template.routing.rules ?? []) as unknown[];
  template.routing.rules = (position === 'top' ? [rule, ...rules] : [...rules, rule]) as never;
}

export function loopbackBackend(port: number): string {
  return `127.0.0.1:${port}`;
}
