import {
  describeOutbound,
  describeRule,
  listOf,
  moveItem,
  parseConfig,
  parseTemplateResponse,
  removeItem,
  serializeConfig,
  upsertItem,
} from './xrayConfig';

const RAW = JSON.stringify({
  log: { loglevel: 'warning' },
  outbounds: [
    { tag: 'direct', protocol: 'freedom' },
    { tag: 'blocked', protocol: 'blackhole' },
    { tag: 'eu', protocol: 'vless', settings: { vnext: [{ address: 'eu.example.com', port: 443 }] } },
  ],
  routing: {
    domainStrategy: 'AsIs',
    rules: [
      { type: 'field', inboundTag: ['api'], outboundTag: 'api' },
      { type: 'field', domain: ['geosite:category-ads-all'], outboundTag: 'blocked' },
      { type: 'field', ip: ['geoip:private'], port: '53', balancerTag: 'lb' },
    ],
    balancers: [{ tag: 'lb', selector: ['eu'] }],
  },
  dns: { servers: ['1.1.1.1'] },
});

describe('xray config template', () => {
  // The template is saved back whole: sections the app never shows must survive.
  it('round-trips the template with unknown sections intact', () => {
    const cfg = parseConfig(RAW);
    expect(JSON.parse(serializeConfig(cfg))).toEqual(JSON.parse(RAW));
  });

  it('reports a broken template instead of saving an empty one over it', () => {
    expect(() => parseConfig('{ not json')).toThrow('xraySetting');
  });

  it('lists nested arrays and treats a missing one as empty', () => {
    const cfg = parseConfig(RAW);
    expect(listOf(cfg, 'routing.rules')).toHaveLength(3);
    expect(listOf(cfg, 'routing.balancers')).toEqual([{ tag: 'lb', selector: ['eu'] }]);
    expect(listOf(parseConfig('{}'), 'outbounds')).toEqual([]);
  });

  it('edits rules by index without touching the rest of the config', () => {
    let cfg = parseConfig(RAW);
    cfg = moveItem(cfg, 'routing.rules', 2, -1);
    expect(listOf(cfg, 'routing.rules').map((r) => (r as { outboundTag?: string }).outboundTag)).toEqual([
      'api',
      undefined,
      'blocked',
    ]);
    cfg = removeItem(cfg, 'routing.rules', 0);
    cfg = upsertItem(cfg, 'routing.rules', -1, { type: 'field', network: 'udp', outboundTag: 'direct' });
    expect(listOf(cfg, 'routing.rules')).toHaveLength(3);
    expect((cfg.routing as { domainStrategy: string }).domainStrategy).toBe('AsIs');
    cfg = upsertItem(cfg, 'outbounds', 0, { tag: 'direct', protocol: 'freedom', settings: { domainStrategy: 'UseIP' } });
    expect(listOf(cfg, 'outbounds')[0]).toEqual({ tag: 'direct', protocol: 'freedom', settings: { domainStrategy: 'UseIP' } });
  });

  it('moving past either end is a no-op', () => {
    const cfg = parseConfig(RAW);
    expect(moveItem(cfg, 'outbounds', 0, -1)).toEqual(cfg);
    expect(moveItem(cfg, 'outbounds', 2, 1)).toEqual(cfg);
  });

  it('summarises outbounds and rules for list rows', () => {
    const cfg = parseConfig(RAW);
    expect(describeOutbound(listOf(cfg, 'outbounds')[2])).toBe('vless · eu.example.com:443');
    expect(describeOutbound(listOf(cfg, 'outbounds')[0])).toBe('freedom');
    expect(describeRule(listOf(cfg, 'routing.rules')[1])).toEqual({
      target: 'blocked',
      match: 'domain: geosite:category-ads-all',
    });
    expect(describeRule(listOf(cfg, 'routing.rules')[2])).toEqual({
      target: '⚖ lb',
      match: 'ip: geoip:private · port: 53',
    });
  });
});

describe('template response', () => {
  // Recorded from a 1.7.1 panel: obj is a JSON string and xraySetting inside it is an object.
  it('accepts the panel shape: stringified obj with an object xraySetting', () => {
    const obj = JSON.stringify({ inboundTags: ['in-1'], outboundTestUrl: 'https://t.example/204', xraySetting: { outbounds: [{ tag: 'direct' }] } });
    const tpl = parseTemplateResponse(obj);
    expect(tpl.outboundTestUrl).toBe('https://t.example/204');
    expect(parseConfig(tpl.xraySetting)).toEqual({ outbounds: [{ tag: 'direct' }] });
  });

  it('also accepts the documented shape with a string xraySetting', () => {
    const tpl = parseTemplateResponse({ xraySetting: '{"log":{}}', outboundTestUrl: '' });
    expect(parseConfig(tpl.xraySetting)).toEqual({ log: {} });
  });
});
