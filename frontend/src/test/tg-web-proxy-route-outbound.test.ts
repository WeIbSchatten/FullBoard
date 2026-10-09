import { describe, expect, it } from 'vitest';

import {
  applyTproxyBackendRule,
  buildTproxyBackendRule,
  buildTproxyTunnelInbound,
  loopbackBackend,
  parseBackendHostPort,
  pickLoopbackListenPort,
  sanitizeProfileTagSlug,
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
  });
});
