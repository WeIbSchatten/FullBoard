import { clientView } from './clientView';

// Recorded from a 1.7.1 panel: /clients/get wraps the record ({client, inboundIds,
// externalLinks}); reading .enable off the wrapper showed every client as disabled.
const GET_CLIENT = {
  client: { id: 1, email: 'alice', subId: 'sub-a', enable: true, totalGB: 100 * 1024 ** 3, expiryTime: 1794953452151, comment: 'family' },
  externalLinks: [],
  inboundIds: [1, 2],
};
const SUB = { subEnable: true, subURI: 'https://sub.example.com/s/', subJsonEnable: true, subJsonURI: 'https://sub.example.com/j/' };
const now = Date.UTC(2026, 9, 19);

it('reads state, quota and subscription URLs from the wrapped record', () => {
  const v = clientView(GET_CLIENT, { up: 1024 ** 3, down: 0 }, SUB, now);
  expect(v.state).toBe('active');
  expect(v.client.enable).toBe(true);
  expect(v.usage).toEqual({ used: 1024 ** 3, total: 100 * 1024 ** 3, ratio: 0.01 });
  expect(v.subUrl).toBe('https://sub.example.com/s/sub-a');
  expect(v.jsonUrl).toBe('https://sub.example.com/j/sub-a');
});

it('leaves out subscription URLs the panel has switched off', () => {
  const v = clientView(GET_CLIENT, null, { ...SUB, subJsonEnable: false }, now);
  expect(v.subUrl).toBe('https://sub.example.com/s/sub-a');
  expect(v.jsonUrl).toBe('');
});
