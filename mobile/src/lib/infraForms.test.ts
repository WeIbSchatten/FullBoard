import { hostGroupPayload, nodePayload } from './infraForms';

describe('nodePayload', () => {
  it('normalises the address the way people paste it and keeps the token write-only', () => {
    expect(
      nodePayload({
        name: ' de-1 ',
        remark: '',
        address: 'https://node1.example.com:2053/secret/',
        port: '',
        basePath: '',
        apiToken: '',
        enable: true,
        allowPrivateAddress: false,
      }),
    ).toEqual({
      name: 'de-1',
      remark: '',
      scheme: 'https',
      address: 'node1.example.com',
      port: 2053,
      basePath: '/secret/',
      apiToken: '',
      clearApiToken: false,
      enable: true,
      allowPrivateAddress: false,
    });
  });

  it('defaults to https and port 2053 for a bare host', () => {
    const out = nodePayload({ name: 'n', remark: '', address: '10.0.0.5', port: '', basePath: '/', apiToken: 't', enable: true, allowPrivateAddress: true });
    expect(out).toMatchObject({ scheme: 'https', address: '10.0.0.5', port: 2053, basePath: '/', apiToken: 't' });
  });

  it.each([
    [{ name: '' }, 'name'],
    [{ address: '' }, 'address'],
    [{ port: '99999' }, 'port'],
  ])('rejects %j naming the field', (patch, field) => {
    const base = { name: 'n', remark: '', address: 'a.example.com', port: '', basePath: '/', apiToken: '', enable: true, allowPrivateAddress: false };
    expect(() => nodePayload({ ...base, ...patch })).toThrow(field);
  });
});

describe('hostGroupPayload', () => {
  // /hosts/update replaces the group, so fields without a form control must survive.
  it('applies the edited fields over the stored group', () => {
    const stored = { groupId: 'g1', remark: 'old', hosts: ['a.example.com'], port: 0, security: 'same', inboundIds: [1], fingerprint: 'chrome', tags: [] };
    const out = hostGroupPayload(stored, {
      remark: 'CDN',
      hosts: 'cdn.example.com, cdn2.example.com:443\n',
      port: '8443',
      security: 'tls',
      sni: 'cdn.example.com',
      path: '/ws',
      hostHeader: '',
      inboundIds: [1, 3],
      isDisabled: false,
    });
    expect(out).toEqual({
      ...stored,
      remark: 'CDN',
      hosts: ['cdn.example.com', 'cdn2.example.com:443'],
      port: 8443,
      security: 'tls',
      sni: 'cdn.example.com',
      path: '/ws',
      hostHeader: '',
      inboundIds: [1, 3],
      isDisabled: false,
    });
  });

  it('needs at least one host and one inbound', () => {
    const form = { remark: '', hosts: ' ', port: '', security: 'same', sni: '', path: '', hostHeader: '', inboundIds: [1], isDisabled: false };
    expect(() => hostGroupPayload(undefined, form)).toThrow('hosts');
    expect(() => hostGroupPayload(undefined, { ...form, hosts: 'a.example.com', inboundIds: [] })).toThrow('inboundIds');
  });
});
