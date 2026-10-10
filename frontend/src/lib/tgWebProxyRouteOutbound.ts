import type { WireInboundPayload } from '@/lib/xray/inbound-form-adapter';
import { buildChainRule, type ChainRoutingRule } from '@/pages/xray/outbounds/cross-server-chain';
import type { XraySettingsValue } from '@/hooks/useXraySetting';

// Loopback listener that receives the official MTProxy process's Telegram
// connections (followRedirect) and sends them through the chosen outbound.
export const MTPROXY_EGRESS_INBOUND_TAG = 'mtproxy-egress';

// Stock freedom "direct" blocks geoip:private, so a rewrite to 127.0.0.1 never
// dials. This outbound allows only that loopback.
export const TPROXY_LOCAL_OUTBOUND_TAG = 'tproxy-local';

export interface TproxyRouteRule extends ChainRoutingRule {
  port?: string;
}

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
): TproxyRouteRule | null {
  return buildChainRule({
    outboundTag,
    inboundTags: [inboundTag],
    domains: [],
    ips: [],
    allTraffic: false,
  });
}

// A remote outbound dials this address on the far side. Loopback and private
// MTProxy targets are only reachable here, and geoip:private would blackhole them.
export function isHostLocalOnly(host: string): boolean {
  const h = host
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h === '::1' || h === '0.0.0.0' || h === '::') return true;
  if (h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd')) return true;
  const parts = h.split('.');
  if (parts.length !== 4) return false;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = nums;
  if (a === 127 || a === 10 || a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

export function outboundTagForBackendRewrite(host: string, selectedOutbound: string): string {
  return isHostLocalOnly(host) ? TPROXY_LOCAL_OUTBOUND_TAG : selectedOutbound;
}

export function tproxyLocalOutbound(): Record<string, unknown> {
  return {
    tag: TPROXY_LOCAL_OUTBOUND_TAG,
    protocol: 'freedom',
    settings: {
      finalRules: [{ action: 'allow', ip: ['127.0.0.1'] }, { action: 'block' }],
    },
  };
}

export function ensureTproxyLocalOutbound(template: XraySettingsValue): void {
  const outbounds = Array.isArray(template.outbounds) ? [...template.outbounds] : [];
  const exists = outbounds.some(
    (o) => o && typeof o === 'object' && 'tag' in o && o.tag === TPROXY_LOCAL_OUTBOUND_TAG,
  );
  if (exists) return;
  outbounds.push(tproxyLocalOutbound() as (typeof outbounds)[number]);
  template.outbounds = outbounds;
}

export function assignedInboundTag(
  created: { tag?: unknown } | null | undefined,
  fallback: string,
): string {
  if (created && typeof created.tag === 'string' && created.tag.trim()) return created.tag.trim();
  return fallback;
}

export function unwrapBackendTarget(
  backend: string,
  inbounds: ProfileEgressInbound[],
): BackendEndpoint | null {
  const parsed = parseBackendHostPort(backend);
  if (!parsed) return null;
  const match = inbounds.find((ib) => ib.port === parsed.port && listensOnProfileHost(ib.listen));
  const rewriteHost = match ? rewriteHostOf(match) : '';
  if (!match || !isHostLocalOnly(rewriteHost)) return parsed;
  const raw = match.settings;
  let port = 0;
  if (typeof raw === 'string') {
    try {
      const body = JSON.parse(raw) as { rewritePort?: unknown };
      port = typeof body.rewritePort === 'number' ? body.rewritePort : 0;
    } catch {
      port = 0;
    }
  } else if (raw && typeof raw.rewritePort === 'number') {
    port = raw.rewritePort;
  }
  if (port < 1 || port > 65535) return parsed;
  return { host: rewriteHost, port };
}

export function buildLocalMtproxyDirectRule(rewrite: BackendEndpoint): TproxyRouteRule | null {
  if (!isHostLocalOnly(rewrite.host)) return null;
  return {
    type: 'field',
    outboundTag: TPROXY_LOCAL_OUTBOUND_TAG,
    ip: [rewrite.host],
    port: String(rewrite.port),
  };
}

function inboundTagsOf(rule: unknown): string[] {
  if (!rule || typeof rule !== 'object') return [];
  const tags = (rule as { inboundTag?: unknown }).inboundTag;
  if (typeof tags === 'string') return [tags];
  if (!Array.isArray(tags)) return [];
  return tags.filter((t): t is string => typeof t === 'string');
}

function isSameLocalCatch(existing: unknown, rule: TproxyRouteRule): boolean {
  if (inboundTagsOf(rule).length > 0 || inboundTagsOf(existing).length > 0) return false;
  if (!rule.ip || !rule.port) return false;
  if (!existing || typeof existing !== 'object') return false;
  const prev = existing as { ip?: unknown; port?: unknown };
  if (String(prev.port ?? '') !== rule.port) return false;
  const ips = Array.isArray(prev.ip) ? prev.ip.map(String) : [];
  return rule.ip.every((ip) => ips.includes(ip));
}

export function applyTproxyBackendRule(
  template: XraySettingsValue,
  rule: TproxyRouteRule,
  position: 'top' | 'bottom' = 'top',
): void {
  if (!template.routing) template.routing = {};
  const rules = (template.routing.rules ?? []) as unknown[];
  const replaceTags = new Set(inboundTagsOf(rule));
  const kept = rules.filter((existing) => {
    if (replaceTags.size > 0 && inboundTagsOf(existing).some((t) => replaceTags.has(t)))
      return false;
    if (isSameLocalCatch(existing, rule)) return false;
    return true;
  });
  template.routing.rules = (position === 'top' ? [rule, ...kept] : [...kept, rule]) as never;
}

export function loopbackBackend(port: number): string {
  return `127.0.0.1:${port}`;
}

export function tproxyBackendInboundTag(profileName: string): string {
  return `tproxy-backend-${sanitizeProfileTagSlug(profileName)}`;
}

export function outboundForInboundTag(
  template: XraySettingsValue | null | undefined,
  inboundTag: string,
): string | null {
  const rules = template?.routing?.rules;
  if (!Array.isArray(rules) || !inboundTag) return null;
  for (const raw of rules) {
    if (!inboundTagsOf(raw).includes(inboundTag)) continue;
    if (!raw || typeof raw !== 'object') continue;
    const rule = raw as { outboundTag?: unknown; balancerTag?: unknown };
    if (typeof rule.outboundTag === 'string' && rule.outboundTag) return rule.outboundTag;
    if (typeof rule.balancerTag === 'string' && rule.balancerTag) return rule.balancerTag;
  }
  return null;
}

// actualInboundTag is the inbound the profile dials. A stale tproxy-backend-*
// rule must not be reported when that port belongs to a different inbound.
export function resolveTproxyBackendOutboundTag(
  template: XraySettingsValue | null | undefined,
  profileName: string,
  actualInboundTag?: string | null,
): string | null {
  const inboundTag = actualInboundTag?.trim() || tproxyBackendInboundTag(profileName);
  return outboundForInboundTag(template, inboundTag);
}

export interface ProfileEgressInbound {
  tag: string;
  port: number;
  listen?: string;
  settings?: { rewriteAddress?: string; rewritePort?: number } | string;
}

function listensOnProfileHost(listen: string | undefined): boolean {
  const value = (listen ?? '').trim();
  return value === '' || value === '127.0.0.1' || value === '0.0.0.0' || value === 'localhost';
}

function rewriteHostOf(inbound: ProfileEgressInbound): string {
  const raw = inbound.settings;
  if (!raw) return '';
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as { rewriteAddress?: unknown };
      return typeof parsed.rewriteAddress === 'string' ? parsed.rewriteAddress : '';
    } catch {
      return '';
    }
  }
  return raw.rewriteAddress ?? '';
}

// The outbound the connectivity check should probe. A loopback MTProxy hop is
// not that outbound: Telegram leaves via mtproxy-egress when that rule exists.
export function resolveProfileEgressOutbound(
  template: XraySettingsValue | null | undefined,
  input: { profileName: string; backend: string; inbounds: ProfileEgressInbound[] },
): string | null {
  const parsed = parseBackendHostPort(input.backend);
  const match = parsed
    ? input.inbounds.find((ib) => ib.port === parsed.port && listensOnProfileHost(ib.listen))
    : undefined;
  const rewriteHost = match ? rewriteHostOf(match) : '';
  const hopIsLocal =
    (rewriteHost !== '' && isHostLocalOnly(rewriteHost)) ||
    (!match && !!parsed && isHostLocalOnly(parsed.host));
  if (hopIsLocal) {
    const egress = outboundForInboundTag(template, MTPROXY_EGRESS_INBOUND_TAG);
    if (egress && egress !== 'direct' && egress !== 'blocked') return egress;
  }
  if (match) return outboundForInboundTag(template, match.tag);
  return resolveTproxyBackendOutboundTag(template, input.profileName);
}
