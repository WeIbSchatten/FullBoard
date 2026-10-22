import { describe, expect, it } from 'vitest';

import {
  SECRET_PATTERN,
  bindAllCandidates,
  generateSecret,
  isLoopbackHostPort,
  isLoopbackHttpUrl,
  nextBackend,
} from '@/lib/tgWebProxy';

// The relay rejects any non-loopback listener/backend; the form must not let one through.
describe('tg-web-proxy loopback validation', () => {
  it.each([
    ['127.0.0.1:2398', true],
    ['127.10.20.30:8081', true],
    ['[::1]:8081', true],
    ['0.0.0.0:8081', false],
    ['localhost:2398', false],
    ['10.0.0.1:2398', false],
    ['127.0.0.1:0', false],
    ['127.0.0.1:70000', false],
    ['127.0.0.256:80', false],
    ['127.0.0.1', false],
  ])('%s -> %s', (value, expected) => {
    expect(isLoopbackHostPort(value)).toBe(expected);
  });

  it('accepts only http:// loopback upstreams without a path', () => {
    expect(isLoopbackHttpUrl('http://127.0.0.1:3000')).toBe(true);
    expect(isLoopbackHttpUrl('https://127.0.0.1:3000')).toBe(false);
    expect(isLoopbackHttpUrl('http://127.0.0.1:3000/app')).toBe(false);
    expect(isLoopbackHttpUrl('http://example.com:3000')).toBe(false);
  });
});

describe('tg-web-proxy secrets and backends', () => {
  it('generates 32 lowercase hex characters the server accepts', () => {
    const secret = generateSecret();
    expect(secret).toMatch(/^[0-9a-f]{32}$/);
    expect(SECRET_PATTERN.test(secret)).toBe(true);
    expect(generateSecret()).not.toBe(secret);
  });

  it('suggests the port after the highest used backend', () => {
    expect(nextBackend([])).toBe('127.0.0.1:2398');
    expect(nextBackend(['127.0.0.1:2398', '127.0.0.1:2405', '127.0.0.1:2399'])).toBe(
      '127.0.0.1:2406',
    );
  });
});

// FR 2: "select all" must leave out clients that live only on a connected node's inbounds
// and clients that already have a TG Web Proxy binding.
describe('bindAllCandidates', () => {
  const inbounds = [
    { id: 1, nodeId: null },
    { id: 2 },
    { id: 10, nodeId: 7 },
    { id: 11, nodeId: 8 },
  ];

  it('picks local clients that have no binding yet', () => {
    const clients = [
      { email: 'zed', inboundIds: [1] },
      { email: 'amy', inboundIds: [2, 10] },
      { email: 'bound', inboundIds: [1] },
      { email: 'node-only', inboundIds: [10, 11] },
      { email: 'detached', inboundIds: [] },
      { email: 'legacy' },
    ];
    expect(bindAllCandidates(clients, inbounds, ['bound'])).toEqual([
      'amy',
      'detached',
      'legacy',
      'zed',
    ]);
  });

  it('treats an inbound missing from the options as local, not as a node one', () => {
    expect(bindAllCandidates([{ email: 'x', inboundIds: [99] }], inbounds, [])).toEqual(['x']);
  });
});
