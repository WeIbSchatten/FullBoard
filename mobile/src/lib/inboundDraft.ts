// Inbound create/edit state. settings/streamSettings/sniffing stay plain JSON
// objects: structured fields write into them and the JSON tab edits them whole.
type Json = Record<string, unknown>;

const GB = 1024 ** 3;
const DAY = 86_400_000;

export interface RandomSource {
  hex: (bytes: number) => string;
  base64: (bytes: number) => string;
  uuid: () => string;
  port: () => number;
}

export const PROTOCOLS = [
  'vless',
  'vmess',
  'trojan',
  'shadowsocks',
  'hysteria',
  'tuic',
  'wireguard',
  'amneziawg',
  'mtproto',
  'masque',
  'http',
  'mixed',
  'tunnel',
  'tun',
] as const;
export type Protocol = (typeof PROTOCOLS)[number];

export const NETWORKS = ['tcp', 'ws', 'grpc', 'httpupgrade', 'xhttp', 'kcp'] as const;
export type Network = (typeof NETWORKS)[number];
export const SECURITIES = ['none', 'tls', 'reality'] as const;
export type Security = (typeof SECURITIES)[number];

// Protocols whose transport and TLS come from Xray stream settings.
export const STREAM_PROTOCOLS: readonly string[] = ['vless', 'vmess', 'trojan', 'shadowsocks'];

// Mirrors frontend/src/lib/xray/protocol-capabilities.ts.
const TLS_NETWORKS = ['tcp', 'ws', 'grpc', 'httpupgrade', 'xhttp'];
const REALITY_PROTOCOLS = ['vless', 'trojan'];
const REALITY_NETWORKS = ['tcp', 'grpc', 'xhttp'];

export function allowedSecurities(protocol: string, network: string): Security[] {
  const out: Security[] = ['none'];
  if (STREAM_PROTOCOLS.includes(protocol) && TLS_NETWORKS.includes(network)) out.push('tls');
  if (REALITY_PROTOCOLS.includes(protocol) && REALITY_NETWORKS.includes(network)) out.push('reality');
  return out;
}

export interface InboundDraft {
  remark: string;
  enable: boolean;
  listen: string;
  port: string;
  protocol: string;
  totalGB: string;
  expiryDays: string;
  settings: Json;
  streamSettings: Json;
  sniffing: Json;
}

export function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Json)[k] : undefined), obj);
}

function setIn(obj: Json, keys: string[], value: unknown): Json {
  const [head, ...rest] = keys;
  if (!rest.length) {
    const next = { ...obj };
    if (value === undefined) delete next[head];
    else next[head] = value;
    return next;
  }
  const child = obj[head] && typeof obj[head] === 'object' ? (obj[head] as Json) : {};
  return { ...obj, [head]: setIn(child, rest, value) };
}

export function setPath(d: InboundDraft, path: string, value: unknown): InboundDraft {
  const [section, ...rest] = path.split('.') as [keyof InboundDraft, ...string[]];
  const root = d[section];
  if (!rest.length || !root || typeof root !== 'object') return { ...d, [section]: value };
  return { ...d, [section]: setIn(root as Json, rest, value) };
}

function defaultSettings(protocol: string, rand: RandomSource): Json {
  switch (protocol) {
    case 'vless':
      return { clients: [], decryption: 'none', encryption: 'none', fallbacks: [] };
    case 'vmess':
      return { clients: [] };
    case 'trojan':
      return { clients: [], fallbacks: [] };
    case 'shadowsocks':
      return { method: '2022-blake3-aes-256-gcm', password: rand.base64(32), network: 'tcp,udp', clients: [], ivCheck: false };
    case 'hysteria':
      return { version: 2, clients: [] };
    case 'http':
      return { accounts: [{ user: rand.hex(4), pass: rand.hex(6) }], allowTransparent: false };
    case 'mixed':
      return { auth: 'password', accounts: [{ user: rand.hex(4), pass: rand.hex(6) }], udp: false, ip: '127.0.0.1' };
    case 'mtproto':
      return { fakeTlsDomain: 'www.cloudflare.com', clients: [] };
    case 'tunnel':
      return { portMap: {}, allowedNetwork: 'tcp,udp', followRedirect: false };
    case 'tun':
      return { name: 'xray0', mtu: 1500, gateway: [], dns: [], userLevel: 0, autoSystemRoutingTable: [], autoOutboundsInterface: 'auto' };
    case 'wireguard':
      return { mtu: 1420, secretKey: '', peers: [], clients: [], noKernelTun: false, subnetIp: '10.0.0.0', subnetCidr: 24 };
    case 'tuic':
      return {
        server: {
          certificate: '',
          private_key: '',
          congestion_control: 'bbr',
          alpn: ['h3', 'spdy/3.1'],
          udp_relay_mode: 'native',
          zero_rtt_handshake: true,
          log_level: 'info',
          max_idle_time: 15,
          authentication_timeout: 3,
          max_udp_relay_packet_size: 1500,
          sni: '',
        },
        clients: [],
      };
    // The panel generates AmneziaWG keys and obfuscation for empty settings on save.
    default:
      return protocol === 'masque' ? { clients: [] } : {};
  }
}

function networkDefaults(network: string): Json {
  switch (network) {
    case 'ws':
    case 'httpupgrade':
      return { path: '/', host: '' };
    case 'grpc':
      return { serviceName: '', multiMode: false };
    case 'xhttp':
      return { path: '/', host: '', mode: 'auto' };
    case 'kcp':
      return { mtu: 1350, tti: 50 };
    default:
      return { header: { type: 'none' } };
  }
}

export function newDraft(protocol: string, rand: RandomSource): InboundDraft {
  const streamed = STREAM_PROTOCOLS.includes(protocol);
  return {
    remark: protocol,
    enable: true,
    listen: '',
    port: String(rand.port()),
    protocol,
    totalGB: '',
    expiryDays: '',
    settings: defaultSettings(protocol, rand),
    streamSettings: streamed ? { network: 'tcp', security: 'none', tcpSettings: networkDefaults('tcp') } : {},
    sniffing: { enabled: streamed, destOverride: ['http', 'tls', 'quic'] },
  };
}

export function setNetwork(d: InboundDraft, network: string): InboundDraft {
  const stream: Json = { ...d.streamSettings };
  for (const n of NETWORKS) delete stream[`${n}Settings`];
  stream.network = network;
  stream[`${network}Settings`] = networkDefaults(network);
  const security = typeof stream.security === 'string' ? stream.security : 'none';
  if (!(allowedSecurities(d.protocol, network) as string[]).includes(security)) {
    stream.security = 'none';
    delete stream.tlsSettings;
    delete stream.realitySettings;
  }
  return { ...d, streamSettings: stream };
}

export function setSecurity(
  d: InboundDraft,
  security: string,
  rand: RandomSource,
  keys?: { privateKey: string; publicKey: string },
): InboundDraft {
  const stream: Json = { ...d.streamSettings, security };
  delete stream.tlsSettings;
  delete stream.realitySettings;
  if (security === 'tls') {
    stream.tlsSettings = {
      serverName: '',
      alpn: ['h2', 'http/1.1'],
      certificates: [{ certificateFile: '', keyFile: '' }],
      settings: { fingerprint: 'chrome' },
    };
  } else if (security === 'reality') {
    stream.realitySettings = {
      show: false,
      xver: 0,
      target: 'www.microsoft.com:443',
      serverNames: ['www.microsoft.com'],
      privateKey: keys?.privateKey ?? '',
      shortIds: [rand.hex(8)],
      settings: { publicKey: keys?.publicKey ?? '', fingerprint: 'chrome', spiderX: '/' },
    };
  }
  return { ...d, streamSettings: stream };
}

export function draftFromInbound(i: {
  remark: string;
  enable: boolean;
  listen: string;
  port: number;
  protocol: string;
  total: number;
  expiryTime: number;
  settings: unknown;
  streamSettings: unknown;
  sniffing: unknown;
}): InboundDraft {
  const asObj = (v: unknown): Json => {
    if (typeof v === 'string') {
      try {
        return (JSON.parse(v) as Json) ?? {};
      } catch {
        return {};
      }
    }
    return v && typeof v === 'object' ? (v as Json) : {};
  };
  return {
    remark: i.remark,
    enable: i.enable,
    listen: i.listen ?? '',
    port: String(i.port),
    protocol: i.protocol,
    totalGB: i.total ? String(Number((i.total / GB).toFixed(2))) : '',
    expiryDays: i.expiryTime > 0 ? String(Math.max(1, Math.ceil((i.expiryTime - Date.now()) / DAY))) : '',
    settings: asObj(i.settings),
    streamSettings: asObj(i.streamSettings),
    sniffing: asObj(i.sniffing),
  };
}

export function payloadFromDraft<T extends Record<string, unknown>>(
  d: InboundDraft,
  original?: T & { total?: number; expiryTime?: number },
  now = Date.now(),
): Record<string, unknown> {
  if (!d.remark.trim()) throw new Error('remark: required');
  const port = Number(d.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('port: 1-65535');
  const before = original ? draftFromInbound(original as never) : undefined;

  const gb = d.totalGB.trim() ? Number(d.totalGB.replace(',', '.')) : 0;
  if (!Number.isFinite(gb) || gb < 0) throw new Error('totalGB: invalid number');
  const total = before && before.totalGB === d.totalGB ? (original?.total ?? 0) : Math.round(gb * GB);

  const days = d.expiryDays.trim() ? Number(d.expiryDays) : 0;
  if (!Number.isInteger(days) || days < 0) throw new Error('expiryDays: invalid number');
  const expiryTime =
    before && before.expiryDays === d.expiryDays ? (original?.expiryTime ?? 0) : days ? now + days * DAY : 0;

  return {
    ...(original ?? {}),
    remark: d.remark.trim(),
    enable: d.enable,
    listen: d.listen.trim(),
    port,
    protocol: d.protocol,
    total,
    expiryTime,
    settings: d.settings,
    streamSettings: d.streamSettings,
    sniffing: d.sniffing,
  };
}
