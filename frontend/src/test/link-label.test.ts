import { describe, it, expect } from 'vitest';

import { parseLinkParts, linkMetaText } from '@/lib/xray/link-label';
import { genAmneziaWGLink } from '@/lib/xray/inbound-link';
import type { AmneziawgInboundSettings } from '@/schemas/protocols/inbound/amneziawg';

// The panel shows the subscription's remark verbatim. Per-client traffic/expiry
// info is rendered only into the body a client app imports (backend, first link
// only), so the panel's display links are already clean — nothing is stripped.
describe('link-label parseLinkParts', () => {
  const linkWith = (remark: string) =>
    `vless://uid@host.example.com:443?type=tcp&security=tls#${encodeURIComponent(remark)}`;

  it('parses protocol / network / security and keeps the remark verbatim', () => {
    const parts = parseLinkParts(linkWith('Germany-john@example.com'));
    expect(parts?.protocol).toBe('Vless');
    expect(parts?.network).toBe('TCP');
    expect(parts?.security).toBe('TLS');
    expect(parts?.remark).toBe('Germany-john@example.com');
    expect(parts?.port).toBe('443');
  });

  it('linkMetaText joins the remark with the port', () => {
    const parts = parseLinkParts(linkWith('Germany-john@example.com'));
    expect(parts && linkMetaText(parts)).toBe('Germany-john@example.com:443');
  });

  it('returns null for an unparseable scheme', () => {
    expect(parseLinkParts('not-a-link')).toBeNull();
  });

  // MTProto share links are tg://proxy deep links whose port rides in a query
  // param, not the URL authority; they carry no transport and use FakeTLS.
  it('labels an mtproto tg://proxy link with its query-param port and FakeTLS', () => {
    const parts = parseLinkParts(
      'tg://proxy?server=host.example.com&port=8443&secret=ee00#mt-inbound',
    );
    expect(parts?.protocol).toBe('MTProto');
    expect(parts?.network).toBe('');
    expect(parts?.security).toBe('FAKETLS');
    expect(parts?.port).toBe('8443');
    expect(parts?.remark).toBe('mt-inbound');
    expect(parts && linkMetaText(parts)).toBe('mt-inbound:8443');
  });

  // AmneziaWG's vpn:// links are base64url of a plain .conf text, not a
  // structured URL (see inbound-link.ts's genAmneziaWGLink) -- there's no
  // query string or #hash available, so the remark/port have to be read back
  // out of the decoded .conf body instead. Regression test for a real report:
  // these links were showing a generic "Vpn" tag and falling back to "Link N"
  // instead of "AmneziaWG" + the actual remark:port, unlike every other
  // protocol's link row.
  it('labels an AmneziaWG vpn:// link with its decoded remark and endpoint port', () => {
    const settings = {
      server: {
        publicKey: 'serverPubKey==',
        jc: 5,
        jmin: 10,
        jmax: 50,
        s1: 30,
        s2: 45,
        s3: 10,
        s4: 5,
        h1: '',
        h2: '',
        h3: '',
        h4: '',
        i1: '',
      },
      clients: [{ email: 'peer-1', privateKey: 'clientPrivKey==', allowedIPs: ['10.8.1.2/32'] }],
    } as unknown as AmneziawgInboundSettings;

    // Cyrillic remark on purpose -- matches the real report, and exercises
    // the unicode round-trip through base64url (not just plain ASCII).
    const link = genAmneziaWGLink({
      settings,
      address: 'awg.example.test',
      port: 36541,
      remark: 'wg-Майфун',
      peerIndex: 0,
    });

    const parts = parseLinkParts(link);
    expect(parts?.protocol).toBe('AmneziaWG');
    expect(parts?.remark).toBe('wg-Майфун');
    expect(parts?.port).toBe('36541');
    expect(parts && linkMetaText(parts)).toBe('wg-Майфун:36541');
  });

  it('labels a tuic link with QUIC network and TLS security', () => {
    const link = 'tuic://uuid:pass@tuic.example.com:8443?congestion_control=bbr#tuic-remark';
    const parts = parseLinkParts(link);
    expect(parts?.protocol).toBe('TUIC');
    expect(parts?.network).toBe('QUIC');
    expect(parts?.security).toBe('TLS');
    expect(parts?.port).toBe('8443');
    expect(parts?.remark).toBe('tuic-remark');
  });

  // Bound clients append https://t.me/webproxy (and sometimes tg://webproxy) to
  // the raw subscription; without a dedicated label they were shown as Https/MTProto.
  it('labels Telegram WEB proxy links with the server query as remark', () => {
    const https = parseLinkParts(
      'https://t.me/webproxy?server=proxy.example.com%2Fpath&secret=abc',
    );
    expect(https?.protocol).toBe('WEB Proxy');
    expect(https?.remark).toBe('proxy.example.com/path');
    expect(https?.network).toBe('');
    expect(https?.security).toBe('');

    const deep = parseLinkParts('tg://webproxy?server=proxy.example.com&secret=abc');
    expect(deep?.protocol).toBe('WEB Proxy');
    expect(deep?.remark).toBe('proxy.example.com');
  });
});

// The subscription page colours each key by what actually protects it, so the
// parser must surface the cipher / flow / obfs a link carries and flag links
// that travel without any encryption layer at all.
describe('link-label encryption details', () => {
  it('reads VLESS post-quantum encryption and the Vision flow', () => {
    const parts = parseLinkParts(
      'vless://uid@h.example.com:443?type=tcp&security=reality&encryption=mlkem768x25519plus.native.0rtt.AAAA&flow=xtls-rprx-vision#r',
    );
    expect(parts?.encryption).toBe('ML-KEM-768');
    expect(parts?.flow).toBe('VISION');
    expect(parts?.unencrypted).toBe(false);
  });

  it('flags plain VLESS without TLS, REALITY or VLESS encryption as unencrypted', () => {
    const parts = parseLinkParts('vless://uid@h.example.com:80?type=ws&encryption=none#r');
    expect(parts?.encryption).toBe('');
    expect(parts?.unencrypted).toBe(true);
  });

  it('reads the VMess cipher from the base64 body', () => {
    const body = btoa(
      JSON.stringify({
        v: '2',
        ps: 'vm',
        port: '8080',
        net: 'ws',
        tls: '',
        scy: 'chacha20-poly1305',
      }),
    );
    const parts = parseLinkParts(`vmess://${body}`);
    expect(parts?.encryption).toBe('CHACHA20-POLY1305');
    expect(parts?.unencrypted).toBe(false);
  });

  it('flags VMess with security none and no TLS as unencrypted', () => {
    const body = btoa(
      JSON.stringify({ v: '2', ps: 'vm', port: '80', net: 'tcp', tls: '', scy: 'none' }),
    );
    const parts = parseLinkParts(`vmess://${body}`);
    expect(parts?.encryption).toBe('NONE');
    expect(parts?.unencrypted).toBe(true);
  });

  it('reads a Shadowsocks 2022 method from percent-encoded SIP022 userinfo', () => {
    const parts = parseLinkParts(
      'ss://2022-blake3-aes-128-gcm:c2VydmVy%3D:Y2xpZW50@h.example.com:9000?type=tcp#ss',
    );
    expect(parts?.encryption).toBe('SS2022 AES-128-GCM');
    expect(parts?.unencrypted).toBe(false);
  });

  it('reads a classic Shadowsocks method from base64 SIP002 userinfo', () => {
    const userinfo = btoa('chacha20-ietf-poly1305:secret').replace(/=+$/, '');
    const parts = parseLinkParts(`ss://${userinfo}@h.example.com:8388#ss`);
    expect(parts?.encryption).toBe('CHACHA20-IETF-POLY1305');
  });

  it('reads Hysteria2 salamander obfuscation', () => {
    const parts = parseLinkParts(
      'hysteria2://auth@h.example.com:7443?security=tls&obfs=salamander&obfs-password=x#hy',
    );
    expect(parts?.obfs).toBe('SALAMANDER');
    expect(parts?.unencrypted).toBe(false);
  });

  it('does not flag Trojan over TLS', () => {
    const parts = parseLinkParts('trojan://pw@h.example.com:443?type=tcp&security=tls#t');
    expect(parts?.unencrypted).toBe(false);
  });
});
