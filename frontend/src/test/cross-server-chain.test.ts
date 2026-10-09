import { describe, expect, it } from 'vitest';

import type { XraySettingsValue } from '@/hooks/useXraySetting';
import {
  applyCrossServerChain,
  buildChainRule,
  chainTagBase,
  outboundFromShareLink,
  shareLinkForNodeClient,
  uniqueOutboundTag,
} from '@/pages/xray/outbounds/cross-server-chain';

const nodeVlessInbound = {
  port: 8443,
  listen: '',
  protocol: 'vless',
  remark: 'edge',
  tag: 'n3-in-8443-tcp',
  settings: JSON.stringify({
    clients: [
      { id: '11111111-2222-3333-4444-555555555555', email: 'relay', flow: '' },
      { id: '99999999-2222-3333-4444-555555555555', email: 'other', flow: '' },
    ],
    decryption: 'none',
  }),
  streamSettings: JSON.stringify({ network: 'tcp', security: 'none', tcpSettings: {} }),
  sniffing: '{}',
};

describe('cross-server chain tags', () => {
  it('slugifies node names and avoids taken tags', () => {
    expect(chainTagBase('Frankfurt #2 (Hetzner)')).toBe('chain-frankfurt-2-hetzner');
    expect(uniqueOutboundTag('chain-fra', ['direct', 'chain-fra', 'chain-fra-2'])).toBe(
      'chain-fra-3',
    );
  });
});

describe('buildChainRule', () => {
  it('returns null when nothing would match', () => {
    expect(
      buildChainRule({
        outboundTag: 'x',
        inboundTags: [' '],
        domains: [],
        ips: [],
        allTraffic: false,
      }),
    ).toBeNull();
  });

  it('dedupes matchers and turns "all traffic" into a tcp,udp network match', () => {
    expect(
      buildChainRule({
        outboundTag: 'chain-fra',
        inboundTags: ['in-443', ' in-443 '],
        domains: ['geosite:netflix'],
        ips: [],
        allTraffic: true,
      }),
    ).toEqual({
      type: 'field',
      outboundTag: 'chain-fra',
      inboundTag: ['in-443'],
      domain: ['geosite:netflix'],
      network: 'tcp,udp',
    });
  });
});

describe('applyCrossServerChain', () => {
  const existing = { type: 'field', outboundTag: 'blocked', ip: ['geoip:private'] };
  const outbound = { tag: 'chain-fra', protocol: 'freedom' };
  const rule = buildChainRule({
    outboundTag: 'chain-fra',
    inboundTags: ['in-443'],
    domains: [],
    ips: [],
    allTraffic: false,
  });

  it.each([
    ['top', [rule, existing]],
    ['bottom', [existing, rule]],
  ] as const)('places the rule at the %s', (position, expected) => {
    const tpl = {
      outbounds: [{ tag: 'direct', protocol: 'freedom' }],
      routing: { rules: [existing] },
    } as unknown as XraySettingsValue;
    applyCrossServerChain(tpl, outbound, rule, position);
    expect(tpl.outbounds?.map((o) => o?.tag)).toEqual(['direct', 'chain-fra']);
    expect(tpl.routing?.rules).toEqual(expected);
  });
});

describe('node inbound to chained outbound', () => {
  it('dials the node address with the chosen client credentials', () => {
    const link = shareLinkForNodeClient({
      nodeAddress: 'node1.example.com',
      inbound: nodeVlessInbound,
      clientEmail: 'relay',
    });
    expect(
      link.startsWith('vless://11111111-2222-3333-4444-555555555555@node1.example.com:8443'),
    ).toBe(true);

    const out = outboundFromShareLink(link, 'chain-node1');
    expect(out?.tag).toBe('chain-node1');
    expect(out?.protocol).toBe('vless');
    expect(JSON.stringify(out?.settings)).toContain('node1.example.com');
    expect(JSON.stringify(out?.settings)).toContain('11111111-2222-3333-4444-555555555555');
    expect(JSON.stringify(out?.settings)).not.toContain('99999999');
  });

  it('yields no link for a client the inbound does not have', () => {
    expect(
      shareLinkForNodeClient({ nodeAddress: 'n', inbound: nodeVlessInbound, clientEmail: 'ghost' }),
    ).toBe('');
  });
});
