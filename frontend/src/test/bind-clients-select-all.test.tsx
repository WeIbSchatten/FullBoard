import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import BindClientsModal from '@/pages/tg-web-proxy/BindClientsModal';
import { HttpUtil, Msg } from '@/utils';

import { renderWithProviders } from './test-utils';

function mockHttp() {
  vi.spyOn(HttpUtil, 'get').mockImplementation(async (url: string) => {
    if (url === '/panel/api/clients/list')
      return new Msg(true, '', [
        { email: 'alice', inboundIds: [1] },
        { email: 'bob', inboundIds: [1, 10] },
        { email: 'nodeonly', inboundIds: [10] },
        { email: 'carol', inboundIds: [1] },
      ]);
    if (url === '/panel/api/inbounds/options')
      return new Msg(true, '', [
        { id: 1, remark: 'local' },
        { id: 10, remark: 'remote', nodeId: 4 },
      ]);
    if (url.endsWith('/bindings'))
      return new Msg(true, '', {
        bindings: [
          {
            clientId: 3,
            email: 'carol',
            profileName: 'eu',
            effectiveProfile: 'eu',
            dedicated: false,
          },
        ],
        syncError: '',
      });
    return new Msg(false, 'unexpected ' + url);
  });
  return vi.spyOn(HttpUtil, 'post').mockResolvedValue(new Msg(true, '', []));
}

afterEach(() => vi.restoreAllMocks());

describe('BindClientsModal select all', () => {
  // FR 2: one click binds every local client, minus node-only and already-bound ones.
  it('binds local unbound clients and skips node-only and already-bound ones', async () => {
    const post = mockHttp();
    renderWithProviders(<BindClientsModal open profileName="eu" onClose={() => {}} />);

    const dialog = await screen.findByRole('dialog');
    const selectAll = await within(dialog).findByRole('button', { name: /Select all \(2\)/ });
    await waitFor(() => expect((selectAll as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(selectAll);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][0]).toBe('/panel/api/tgWebProxy/bindings/bindMany');
    expect(post.mock.calls[0][1]).toEqual({
      emails: ['alice', 'bob'],
      profileName: 'eu',
      dedicated: true,
    });
  });
});
