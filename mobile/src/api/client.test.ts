import { ApiError, apiRequest, normalizeBaseUrl } from './client';

function respond(status: number, body: unknown) {
  return jest.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe('normalizeBaseUrl', () => {
  // People paste the address bar: with or without scheme, with the secret base path.
  it.each([
    ['panel.example.com:2053/abc', 'https://panel.example.com:2053/abc'],
    ['  https://panel.example.com/abc/  ', 'https://panel.example.com/abc'],
    ['http://10.0.0.5:2053', 'http://10.0.0.5:2053'],
    ['https://panel.example.com/abc/panel/', 'https://panel.example.com/abc'],
  ])('%s -> %s', (input, want) => {
    expect(normalizeBaseUrl(input)).toBe(want);
  });

  it('rejects an empty address', () => {
    expect(() => normalizeBaseUrl('   ')).toThrow(ApiError);
  });
});

describe('apiRequest', () => {
  const session = { baseUrl: 'https://panel.example.com/abc', token: 'tok' };

  it('sends the bearer token and unwraps obj', async () => {
    const fetchImpl = respond(200, { success: true, obj: { cpu: 5 } });
    const obj = await apiRequest<{ cpu: number }>(session, 'POST', '/panel/api/clients/add', { a: 1 }, fetchImpl);
    expect(obj).toEqual({ cpu: 5 });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://panel.example.com/abc/panel/api/clients/add');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(init.body).toBe('{"a":1}');
  });

  it('turns success:false into an ApiError carrying the panel message', async () => {
    const fetchImpl = respond(200, { success: false, msg: 'inbound 7: port in use' });
    await expect(apiRequest(session, 'GET', '/panel/api/x', undefined, fetchImpl)).rejects.toMatchObject({
      message: 'inbound 7: port in use',
      kind: 'panel',
    });
  });

  it.each([
    [401, 'unauthorized'],
    [404, 'notFound'],
    [502, 'http'],
  ] as const)('maps HTTP %i to %s', async (status, kind) => {
    const fetchImpl = respond(status, {});
    await expect(apiRequest(session, 'GET', '/panel/api/x', undefined, fetchImpl)).rejects.toMatchObject({ kind });
  });

  it('reports an unreachable panel as a network error', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    await expect(apiRequest(session, 'GET', '/panel/api/x', undefined, fetchImpl)).rejects.toMatchObject({
      kind: 'network',
    });
  });
});
