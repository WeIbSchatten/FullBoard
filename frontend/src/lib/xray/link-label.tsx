import { useTranslation } from 'react-i18next';
import { Tooltip } from 'antd';

import { Base64 } from '@/utils';
import './link-tags.css';

/* Shared parsing + rendering for the "protocol / transport / security /
   encryption" labels shown above share links in the QR modal, the client info modal
   and the subscription page. Keeping it in one place means the colour
   scheme and the email/stats stripping stay identical across all three. */

export interface LinkParts {
  protocol: string;
  network: string;
  security: string;
  remark: string;
  port: string;
  encryption: string;
  flow: string;
  obfs: string;
  unencrypted: boolean;
}

const PROTOCOL_LABELS: Record<string, string> = {
  vless: 'Vless',
  vmess: 'Vmess',
  trojan: 'Trojan',
  ss: 'Shadowsocks',
  shadowsocks: 'Shadowsocks',
  hysteria2: 'Hysteria2',
  hy2: 'Hysteria2',
  hysteria: 'Hysteria',
  wireguard: 'WireGuard',
  wg: 'WireGuard',
  tg: 'MTProto',
  vpn: 'AmneziaWG',
  tuic: 'TUIC',
};

// Tones map to .fb-link-tag--<tone> in link-tags.css; one hue per protocol.
const PROTOCOL_TONES: Record<string, string> = {
  Vless: 'vless',
  Vmess: 'vmess',
  Trojan: 'trojan',
  Shadowsocks: 'shadowsocks',
  Hysteria: 'hysteria',
  Hysteria2: 'hysteria',
  WireGuard: 'wireguard',
  MTProto: 'telegram',
  AmneziaWG: 'amneziawg',
  TUIC: 'tuic',
  'WEB Proxy': 'telegram',
};

function isTgWebProxyLink(link: string): boolean {
  return /^(https:\/\/t\.me\/webproxy|tg:\/\/webproxy)\?/i.test(link);
}

const SECURITY_TONES: Record<string, string> = {
  TLS: 'tls',
  XTLS: 'tls',
  FAKETLS: 'tls',
  REALITY: 'reality',
};

// Reverse of inbound-link.ts's own toBase64Url — base64url (RFC 4648 §5, no
// padding) back to the original unicode text, needed to read the remark/
// endpoint back out of a vpn:// link's opaque payload below.
function fromBase64Url(value: string): string {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/* Pull protocol, transport, security plus the remark and port out of a share
   link. vless/trojan carry network+security as `type`/`security` query params
   and the remark in the URL hash; vmess packs them into the base64 JSON as
   `net`/`tls`/`ps`/`port`. Returns null when the scheme is unknown or the
   payload can't be parsed, so callers fall back to "Link N".

   The remark is shown verbatim: the panel displays the subscription's clean
   (name-only) remarks — the per-client traffic/expiry info is rendered only
   into the body a client app imports, so there is nothing to strip here. */
export function parseLinkParts(link: string): LinkParts | null {
  const trimmed = link.trim();
  // https://t.me/webproxy and tg://webproxy must win over generic https/tg labels.
  if (isTgWebProxyLink(trimmed)) {
    let remark = '';
    try {
      remark = new URL(trimmed).searchParams.get('server')?.trim() ?? '';
    } catch {
      /* keep empty remark */
    }
    return {
      protocol: 'WEB Proxy',
      network: '',
      security: '',
      remark,
      port: '',
      encryption: '',
      flow: '',
      obfs: '',
      unencrypted: false,
    };
  }
  const scheme = /^([a-z0-9]+):\/\//i.exec(trimmed)?.[1]?.toLowerCase() ?? '';
  if (!scheme) return null;
  const protocol = PROTOCOL_LABELS[scheme] ?? scheme.charAt(0).toUpperCase() + scheme.slice(1);
  let network = '';
  let security = '';
  let remark = '';
  let port = '';
  let encryption = '';
  let flow = '';
  let obfs = '';
  if (scheme === 'vmess') {
    try {
      const json = JSON.parse(Base64.decode(trimmed.slice('vmess://'.length).split('#')[0])) as {
        net?: string;
        tls?: string;
        ps?: string;
        port?: string | number;
        scy?: string;
      };
      network = json.net ?? '';
      security = json.tls ?? '';
      remark = typeof json.ps === 'string' ? json.ps : '';
      port = json.port != null ? String(json.port) : '';
      encryption = (json.scy ?? '').toUpperCase();
    } catch {
      /* unparseable payload, fall back to protocol only */
    }
  } else if (scheme === 'vpn') {
    /* AmneziaWG's vpn:// links are base64url of a plain .conf text (matching
       the real AmneziaVPN app's own share-link scheme), not a structured URL
       — there's no query string or #hash to read a remark/port from without
       corrupting the payload the app itself needs to decode. The remark and
       endpoint are still in there as plain .conf lines, though, so pull them
       back out directly. */
    try {
      const cfgText = fromBase64Url(trimmed.slice('vpn://'.length));
      remark = /^#\s?(.*)$/m.exec(cfgText)?.[1]?.trim() ?? '';
      port = /^Endpoint\s*=\s*.+:(\d+)\s*$/m.exec(cfgText)?.[1] ?? '';
    } catch {
      /* unparseable payload, fall back to protocol only */
    }
  } else {
    try {
      const url = new URL(trimmed);
      network = url.searchParams.get('type') ?? '';
      security = url.searchParams.get('security') ?? '';
      /* tg://proxy links (mtproto) carry the port in a `port` query param, not
         the URL authority, so fall back to it when there is no authority port. */
      port = url.port || (url.searchParams.get('port') ?? '');
      if (scheme === 'vless') encryption = vlessEncryptionLabel(url.searchParams.get('encryption'));
      if (url.searchParams.get('flow')?.startsWith('xtls-rprx-vision')) flow = 'VISION';
      obfs = (url.searchParams.get('obfs') ?? '').toUpperCase();
      if (scheme === 'ss') encryption = shadowsocksMethodLabel(url);
      const hash = url.hash.replace(/^#/, '');
      try {
        remark = decodeURIComponent(hash);
      } catch {
        remark = hash;
      }
    } catch {
      /* not URL-shaped, fall back to protocol only */
    }
    if (scheme === 'tg') security = 'FakeTLS';
    if (scheme === 'tuic') {
      network = 'quic';
      security = 'TLS';
    }
  }
  if (security === 'none') security = '';
  return {
    protocol,
    network: network.toUpperCase(),
    security: security.toUpperCase(),
    remark: remark.trim(),
    port,
    encryption,
    flow,
    obfs,
    unencrypted: isUnencrypted(scheme, security, encryption),
  };
}

// VLESS encryption is always the mlkem768x25519plus hybrid; only its auth key varies.
function vlessEncryptionLabel(value: string | null): string {
  return value && value !== 'none' ? 'ML-KEM-768' : '';
}

// SIP022 userinfo is percent-encoded "method:key[:key]"; SIP002 is base64url("method:password").
function shadowsocksMethodLabel(url: URL): string {
  let raw: string;
  try {
    raw = decodeURIComponent(url.username);
  } catch {
    raw = url.username;
  }
  if (!url.password && !raw.includes(':')) {
    try {
      raw = Base64.decode(raw.replace(/-/g, '+').replace(/_/g, '/'));
    } catch {
      return '';
    }
  }
  const method = raw.split(':')[0].toLowerCase();
  const ss2022 = '2022-blake3-';
  if (method.startsWith(ss2022)) return `SS2022 ${method.slice(ss2022.length).toUpperCase()}`;
  return method.toUpperCase();
}

const NULL_CIPHERS = new Set(['', 'NONE', 'ZERO', 'PLAIN']);

// Only these schemes can carry payload in the clear; the rest always encrypt (QUIC, Noise, MTProto).
function isUnencrypted(scheme: string, security: string, encryption: string): boolean {
  if (security) return false;
  switch (scheme) {
    case 'vless':
    case 'trojan':
      return !encryption;
    case 'vmess':
    case 'ss':
      return NULL_CIPHERS.has(encryption);
    default:
      return false;
  }
}

/* The inbound remark and port joined as they appear after the tags, e.g.
   "22:10452". Either piece may be empty. */
export function linkMetaText(parts: LinkParts): string {
  return [parts.remark, parts.port].filter(Boolean).join(':');
}

function LinkTag({ tone, hint, children }: { tone: string; hint: string; children: string }) {
  return (
    <Tooltip title={hint}>
      <span className={`fb-link-tag fb-link-tag--${tone}`}>{children}</span>
    </Tooltip>
  );
}

export function LinkTags({ parts }: { parts: LinkParts }) {
  const { t } = useTranslation();
  return (
    <span className="fb-link-tags">
      <LinkTag tone={PROTOCOL_TONES[parts.protocol] ?? 'neutral'} hint={t('linkTags.protocol')}>
        {parts.protocol}
      </LinkTag>
      {parts.network && (
        <LinkTag tone="transport" hint={t('linkTags.transport')}>
          {parts.network}
        </LinkTag>
      )}
      {parts.security && (
        <LinkTag tone={SECURITY_TONES[parts.security] ?? 'tls'} hint={t('linkTags.security')}>
          {parts.security}
        </LinkTag>
      )}
      {parts.encryption && !parts.unencrypted && (
        <LinkTag
          tone={parts.encryption === 'ML-KEM-768' ? 'pq' : 'cipher'}
          hint={t('linkTags.encryption')}
        >
          {parts.encryption}
        </LinkTag>
      )}
      {parts.flow && (
        <LinkTag tone="flow" hint={t('linkTags.flow')}>
          {parts.flow}
        </LinkTag>
      )}
      {parts.obfs && (
        <LinkTag tone="obfs" hint={t('linkTags.obfs')}>
          {parts.obfs}
        </LinkTag>
      )}
      {parts.unencrypted && (
        <LinkTag tone="danger" hint={t('linkTags.noEncryptionHint')}>
          {t('linkTags.noEncryption')}
        </LinkTag>
      )}
    </span>
  );
}
