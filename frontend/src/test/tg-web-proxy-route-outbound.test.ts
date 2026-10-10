import { describe, expect, it } from 'vitest';

import {
  applyTproxyBackendRule,
  assignedInboundTag,
  buildTproxyBackendRule,
  buildTproxyTunnelInbound,
  ensureTproxyLocalOutbound,
  isHostLocalOnly,
  loopbackBackend,
  MTPROXY_EGRESS_INBOUND_TAG,
  TPROXY_LOCAL_OUTBOUND_TAG,
  outboundTagForBackendRewrite,
  unwrapBackendTarget,
  parseBackendHostPort,
  pickLoopbackListenPort,
  resolveProfileEgressOutbound,
  resolveTproxyBackendOutboundTag,
  sanitizeProfileTagSlug,
  tproxyBackendInboundTag,
} from '@/lib/tgWebProxyRouteOutbound';
import type { XraySettingsValue } from '@/hooks/useXraySetting';

describe('parseBackendHostPort', () => {
  it('parses host:port', () => {
    expect(parseBackendHostPort('127.0.0.1:2398')).toEqual({ host: '127.0.0.1', port: 2398 });
  });

  it('rejects missing port', () => {
    expect(parseBackendHostPort('127.0.0.1')).toBeNull();
  });
});

describe('buildTproxyTunnelInbound', () => {
  it('builds a loopback tunnel that rewrites to the original backend', () => {
    const inbound = buildTproxyTunnelInbound({
      profileName: 'Alpha Beta',
      listenPort: 31234,
      rewrite: { host: '10.0.0.5', port: 443 },
    });
    expect(inbound.listen).toBe('127.0.0.1');
    expect(inbound.port).toBe(31234);
    expect(inbound.protocol).toBe('tunnel');
    expect(inbound.excludeFromSub).toBe(true);
    expect(inbound.tag).toBe('tproxy-backend-alpha-beta');
    const settings = JSON.parse(inbound.settings);
    expect(settings.rewriteAddress).toBe('10.0.0.5');
    expect(settings.rewritePort).toBe(443);
  });
});

describe('buildTproxyBackendRule', () => {
  it('routes the tunnel inbound tag to the chosen outbound', () => {
    const rule = buildTproxyBackendRule('tproxy-backend-alpha', 'proxy-de');
    expect(rule).toEqual({
      type: 'field',
      outboundTag: 'proxy-de',
      inboundTag: ['tproxy-backend-alpha'],
    });
  });
});

describe('applyTproxyBackendRule', () => {
  it('prepends the rule to the template routing list', () => {
    const template: XraySettingsValue = {
      routing: { rules: [{ type: 'field', outboundTag: 'direct', network: 'udp' }] },
    };
    const rule = buildTproxyBackendRule('tproxy-backend-a', 'out')!;
    applyTproxyBackendRule(template, rule, 'top');
    expect(template.routing?.rules?.[0]).toEqual(rule);
    expect(template.routing?.rules).toHaveLength(2);
  });
});

describe('helpers', () => {
  it('picks an unused listen port', () => {
    const port = pickLoopbackListenPort([31000, 31001]);
    expect(port).toBeGreaterThanOrEqual(31000);
    expect(port).toBeLessThan(41000);
    expect(port).not.toBe(31000);
    expect(port).not.toBe(31001);
  });

  it('sanitizes tags and formats loopback backend', () => {
    expect(sanitizeProfileTagSlug('My Profile!')).toBe('my-profile');
    expect(loopbackBackend(32001)).toBe('127.0.0.1:32001');
    expect(tproxyBackendInboundTag('Alpha Beta')).toBe('tproxy-backend-alpha-beta');
  });
});

describe('outboundTagForBackendRewrite', () => {
  it('keeps a loopback MTProxy on direct so a remote outbound cannot dial 127.0.0.1', () => {
    expect(isHostLocalOnly('127.0.0.1')).toBe(true);
    expect(isHostLocalOnly('::1')).toBe(true);
    expect(isHostLocalOnly('10.8.0.1')).toBe(true);
    expect(isHostLocalOnly('192.168.1.9')).toBe(true);
    expect(isHostLocalOnly('172.16.5.5')).toBe(true);
    expect(outboundTagForBackendRewrite('127.0.0.1', 'Fin-t3um9k7iu1')).toBe(
      TPROXY_LOCAL_OUTBOUND_TAG,
    );
  });

  it('sends a public MTProxy through the chosen outbound', () => {
    expect(isHostLocalOnly('203.0.113.10')).toBe(false);
    expect(outboundTagForBackendRewrite('203.0.113.10', 'Fin-t3um9k7iu1')).toBe('Fin-t3um9k7iu1');
  });

  it('follows a tunnel that already rewrites to loopback instead of nesting it', () => {
    expect(
      unwrapBackendTarget('127.0.0.1:32442', [
        {
          tag: 'in-32442-tcp',
          port: 32442,
          listen: '127.0.0.1',
          settings: { rewriteAddress: '127.0.0.1', rewritePort: 2398 },
        },
      ]),
    ).toEqual({ host: '127.0.0.1', port: 2398 });
  });

  it('adds a freedom outbound that can dial loopback when direct blocks private IPs', () => {
    const template: XraySettingsValue = {
      outbounds: [
        {
          tag: 'direct',
          protocol: 'freedom',
          settings: {
            finalRules: [{ action: 'block', ip: ['geoip:private'] }, { action: 'allow' }],
          },
        },
      ],
    };
    ensureTproxyLocalOutbound(template);
    ensureTproxyLocalOutbound(template);
    const added = (template.outbounds ?? []).filter(
      (o) => o && typeof o === 'object' && 'tag' in o && o.tag === TPROXY_LOCAL_OUTBOUND_TAG,
    );
    expect(added).toHaveLength(1);
    const settings = (added[0] as { settings?: { finalRules?: { action: string }[] } }).settings;
    expect(settings?.finalRules?.[0]?.action).toBe('allow');
    expect(settings?.finalRules?.[1]?.action).toBe('block');
  });
});

describe('assignedInboundTag', () => {
  it('uses the tag the server stored when the requested tag was already taken', () => {
    expect(assignedInboundTag({ tag: 'in-32442-tcp' }, 'tproxy-backend-default')).toBe(
      'in-32442-tcp',
    );
    expect(assignedInboundTag({}, 'tproxy-backend-default')).toBe('tproxy-backend-default');
  });
});

describe('resolveTproxyBackendOutboundTag', () => {
  it('returns the outbound tagged by the profile tunnel rule', () => {
    const template: XraySettingsValue = {
      routing: {
        rules: [
          {
            type: 'field',
            inboundTag: ['tproxy-backend-alpha-beta'],
            outboundTag: 'proxy-de',
          },
          { type: 'field', outboundTag: 'direct', network: 'udp' },
        ],
      },
    };
    expect(resolveTproxyBackendOutboundTag(template, 'Alpha Beta')).toBe('proxy-de');
  });

  it('returns null when no route-via rule exists', () => {
    const template: XraySettingsValue = {
      routing: { rules: [{ type: 'field', outboundTag: 'direct' }] },
    };
    expect(resolveTproxyBackendOutboundTag(template, 'default')).toBeNull();
  });

  it('does not report a stale slug rule when the profile listens on another inbound', () => {
    const template: XraySettingsValue = {
      routing: {
        rules: [
          {
            type: 'field',
            inboundTag: ['tproxy-backend-default'],
            outboundTag: 'Fin-t3um9k7iu1',
          },
          { type: 'field', ip: ['geoip:private'], outboundTag: 'blocked' },
        ],
      },
    };
    expect(resolveTproxyBackendOutboundTag(template, 'default', 'in-32442-tcp')).toBeNull();
  });
});

describe('resolveProfileEgressOutbound', () => {
  it('checks the outbound of the inbound the profile backend actually uses', () => {
    const template: XraySettingsValue = {
      routing: {
        rules: [
          {
            type: 'field',
            inboundTag: ['tproxy-backend-default'],
            outboundTag: 'Fin-t3um9k7iu1',
          },
          { type: 'field', inboundTag: ['in-32442-tcp'], outboundTag: 'direct' },
        ],
      },
    };
    expect(
      resolveProfileEgressOutbound(template, {
        profileName: 'default',
        backend: '127.0.0.1:32442',
        inbounds: [{ tag: 'in-32442-tcp', port: 32442, listen: '127.0.0.1' }],
      }),
    ).toBe('direct');
  });

  it('checks mtproxy telegram egress when the backend hop is only local', () => {
    const template: XraySettingsValue = {
      routing: {
        rules: [
          { type: 'field', inboundTag: ['in-32442-tcp'], outboundTag: 'direct' },
          {
            type: 'field',
            inboundTag: [MTPROXY_EGRESS_INBOUND_TAG],
            outboundTag: 'Fin-t3um9k7iu1',
          },
        ],
      },
    };
    expect(
      resolveProfileEgressOutbound(template, {
        profileName: 'default',
        backend: '127.0.0.1:32442',
        inbounds: [
          {
            tag: 'in-32442-tcp',
            port: 32442,
            listen: '127.0.0.1',
            settings: { rewriteAddress: '127.0.0.1', rewritePort: 2398 },
          },
        ],
      }),
    ).toBe('Fin-t3um9k7iu1');
  });
});

describe('applyTproxyBackendRule', () => {
  it('replaces an older rule for the same inbound instead of stacking one', () => {
    const template: XraySettingsValue = {
      routing: {
        rules: [
          { type: 'field', inboundTag: ['tproxy-backend-default'], outboundTag: 'old' },
          { type: 'field', ip: ['geoip:private'], outboundTag: 'blocked' },
        ],
      },
    };
    const rule = buildTproxyBackendRule('tproxy-backend-default', 'direct')!;
    applyTproxyBackendRule(template, rule, 'top');
    expect(template.routing?.rules).toEqual([
      rule,
      { type: 'field', ip: ['geoip:private'], outboundTag: 'blocked' },
    ]);
  });
});
