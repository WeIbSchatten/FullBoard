import {
  allowedSecurities,
  draftFromInbound,
  getPath,
  newDraft,
  payloadFromDraft,
  setNetwork,
  setPath,
  setSecurity,
  type RandomSource,
} from './inboundDraft';

const rand: RandomSource = {
  hex: (n) => 'a'.repeat(n * 2),
  base64: (n) => `b64-${n}`,
  uuid: () => 'uuid-1',
  port: () => 40123,
};
const now = Date.UTC(2026, 9, 19);
const DAY = 86_400_000;

describe('inbound draft', () => {
  it('starts a VLESS inbound on a random port with an empty client list', () => {
    const d = newDraft('vless', rand);
    expect(d).toMatchObject({ protocol: 'vless', port: '40123', enable: true });
    expect(d.settings).toEqual({ clients: [], decryption: 'none', encryption: 'none', fallbacks: [] });
    expect(getPath(d.streamSettings, 'network')).toBe('tcp');
  });

  it('seeds a Shadowsocks 2022 key of the cipher length', () => {
    const d = newDraft('shadowsocks', rand);
    expect(d.settings).toMatchObject({ method: '2022-blake3-aes-256-gcm', password: 'b64-32', network: 'tcp,udp' });
  });

  it('switching transport keeps one settings block for the chosen network', () => {
    let d = newDraft('vless', rand);
    d = setNetwork(d, 'ws');
    d = setPath(d, 'streamSettings.wsSettings.path', '/ray');
    d = setNetwork(d, 'xhttp');
    expect(getPath(d.streamSettings, 'network')).toBe('xhttp');
    expect(getPath(d.streamSettings, 'wsSettings')).toBeUndefined();
    expect(getPath(d.streamSettings, 'xhttpSettings')).toEqual({ path: '/', host: '', mode: 'auto' });
  });

  it('Reality gets a destination, a short id and the given keypair', () => {
    const d = setSecurity(newDraft('vless', rand), 'reality', rand, { privateKey: 'priv', publicKey: 'pub' });
    expect(getPath(d.streamSettings, 'security')).toBe('reality');
    expect(getPath(d.streamSettings, 'realitySettings')).toMatchObject({
      target: 'www.microsoft.com:443',
      serverNames: ['www.microsoft.com'],
      privateKey: 'priv',
      shortIds: ['aaaaaaaaaaaaaaaa'],
      settings: { publicKey: 'pub', fingerprint: 'chrome' },
    });
    expect(getPath(d.streamSettings, 'tlsSettings')).toBeUndefined();
  });

  // /inbounds/update replaces the row: fields the form does not show must survive.
  it('round-trips an existing inbound and keeps fields the form does not know', () => {
    const inbound = {
      id: 5,
      remark: 'EU',
      enable: true,
      listen: '',
      port: 443,
      protocol: 'vless',
      total: 0,
      expiryTime: 0,
      trafficReset: 'never',
      settings: { clients: [{ id: 'x', email: 'a' }], decryption: 'none', custom: 1 },
      streamSettings: { network: 'tcp', security: 'none', sockopt: { mark: 7 } },
      sniffing: { enabled: true, destOverride: ['http', 'tls'] },
      tag: 'inbound-443',
    };
    const out = payloadFromDraft(draftFromInbound(inbound), inbound, now);
    expect(out).toMatchObject({
      remark: 'EU',
      port: 443,
      settings: inbound.settings,
      streamSettings: inbound.streamSettings,
      sniffing: inbound.sniffing,
      tag: 'inbound-443',
    });
  });

  it('turns quota and days into bytes and an expiry timestamp', () => {
    const d = { ...newDraft('trojan', rand), totalGB: '10', expiryDays: '30' };
    expect(payloadFromDraft(d, undefined, now)).toMatchObject({
      total: 10 * 1024 ** 3,
      expiryTime: now + 30 * DAY,
      port: 40123,
    });
  });

  it.each([
    [{ port: '70000' }, 'port'],
    [{ remark: '' }, 'remark'],
  ])('rejects %j naming the field', (patch, field) => {
    expect(() => payloadFromDraft({ ...newDraft('vless', rand), ...patch }, undefined, now)).toThrow(field);
  });
});

describe('allowed security', () => {
  // Same rules as the panel's protocol-capabilities: Xray rejects REALITY over ws and TLS over kcp.
  it.each([
    ['vless', 'tcp', ['none', 'tls', 'reality']],
    ['vless', 'ws', ['none', 'tls']],
    ['vmess', 'grpc', ['none', 'tls']],
    ['trojan', 'xhttp', ['none', 'tls', 'reality']],
    ['vless', 'kcp', ['none']],
  ])('%s over %s', (protocol, network, want) => {
    expect(allowedSecurities(protocol, network)).toEqual(want);
  });

  it('switching to a transport that cannot carry REALITY drops it', () => {
    let d = setSecurity(newDraft('vless', rand), 'reality', rand, { privateKey: 'p', publicKey: 'q' });
    d = setNetwork(d, 'ws');
    expect(getPath(d.streamSettings, 'security')).toBe('none');
    expect(getPath(d.streamSettings, 'realitySettings')).toBeUndefined();
  });
});
