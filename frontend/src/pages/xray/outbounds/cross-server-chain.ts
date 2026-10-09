import type { XraySettingsValue } from '@/hooks/useXraySetting';
import { parseOutboundLink } from '@/lib/xray/outbound-link-parser';
import { formValuesToWirePayload, rawOutboundToFormValues } from '@/lib/xray/outbound-form-adapter';
import { genAllLinks, getInboundClients } from '@/lib/xray/inbound-link';
import { inboundFromDb, type DbInboundLike } from '@/lib/xray/inbound-from-db';

export type ChainRulePosition = 'top' | 'bottom';

export interface ChainRuleInput {
  outboundTag: string;
  inboundTags: string[];
  domains: string[];
  ips: string[];
  allTraffic: boolean;
}

export interface ChainRoutingRule {
  type: 'field';
  outboundTag: string;
  inboundTag?: string[];
  domain?: string[];
  ip?: string[];
  network?: string;
}

export type ChainOutbound = Record<string, unknown> & { tag: string };

export function chainTagBase(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `chain-${slug || 'server'}`;
}

export function uniqueOutboundTag(base: string, existing: Iterable<string>): string {
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

// Goes through the same parse → form → wire pipeline as the outbound modal's
// link import, so a chained outbound is exactly what a pasted link would yield.
export function outboundFromShareLink(link: string, tag: string): ChainOutbound | null {
  const parsed = parseOutboundLink(link);
  if (!parsed) return null;
  parsed.tag = tag;
  const wire = formValuesToWirePayload(rawOutboundToFormValues(parsed)) as Record<string, unknown>;
  return { ...wire, tag };
}

export interface NodeInboundSource {
  nodeAddress: string;
  inbound: DbInboundLike;
  clientEmail: string;
}

export function shareLinkForNodeClient(src: NodeInboundSource): string {
  const inbound = inboundFromDb(src.inbound);
  const client = (getInboundClients(inbound) ?? []).find((c) => c.email === src.clientEmail);
  if (!client) return '';
  const [first] = genAllLinks({
    inbound,
    client,
    remark: src.clientEmail,
    hostOverride: src.nodeAddress,
    fallbackHostname: src.nodeAddress,
  });
  return first?.link ?? '';
}

function cleanList(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

// A rule with no matcher would capture nothing in Xray; "all traffic" is an
// explicit tcp,udp network match instead.
export function buildChainRule(input: ChainRuleInput): ChainRoutingRule | null {
  const rule: ChainRoutingRule = { type: 'field', outboundTag: input.outboundTag };
  const inboundTag = cleanList(input.inboundTags);
  const domain = cleanList(input.domains);
  const ip = cleanList(input.ips);
  if (inboundTag.length) rule.inboundTag = inboundTag;
  if (domain.length) rule.domain = domain;
  if (ip.length) rule.ip = ip;
  if (input.allTraffic) rule.network = 'tcp,udp';
  if (!inboundTag.length && !domain.length && !ip.length && !input.allTraffic) return null;
  return rule;
}

export function applyCrossServerChain(
  template: XraySettingsValue,
  outbound: ChainOutbound,
  rule: ChainRoutingRule | null,
  position: ChainRulePosition,
): void {
  if (!Array.isArray(template.outbounds)) template.outbounds = [];
  template.outbounds.push(outbound as never);
  if (!rule) return;
  if (!template.routing) template.routing = {};
  const rules = (template.routing.rules ?? []) as unknown[];
  template.routing.rules = (position === 'top' ? [rule, ...rules] : [...rules, rule]) as never;
}
