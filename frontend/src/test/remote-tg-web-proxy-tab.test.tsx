import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import RemoteTgWebProxyTab from '@/pages/nodes/RemoteTgWebProxyTab';
import { HttpUtil, Msg } from '@/utils';

import { renderWithProviders } from './test-utils';

const NODE = 3;
const SNAPSHOT = {
  config: {},
  configExists: true,
  profilesExists: true,
  profiles: [
    { name: 'eu', secret: '000102030405060708090a0b0c0d0e0f', backend: '127.0.0.1:2398' },
    { name: 'fb:bob', secret: 'ffffffffffffffffffffffffffffffff', backend: '127.0.0.1:2398' },
  ],
};

function mockHttp() {
  vi.spyOn(HttpUtil, 'get').mockImplementation(async (url: string) => {
    if (url.endsWith('/tgWebProxy/status')) return new Msg(true, '', { supported: true });
    if (url.endsWith('/tgWebProxy/config')) return new Msg(true, '', SNAPSHOT);
    if (url.endsWith('/bindings')) return new Msg(true, '', { bindings: [], syncError: '' });
    if (url === '/panel/api/clients/list')
      return new Msg(true, '', [{ email: 'alice' }, { email: 'bob' }, { email: 'carol' }]);
    return new Msg(false, 'unexpected ' + url);
  });
  return vi.spyOn(HttpUtil, 'post').mockResolvedValue(new Msg(true, '', []));
}

async function profileRow(name: string): Promise<HTMLElement> {
  const cell = await screen.findByText(name);
  return cell.closest('tr') as HTMLElement;
}

function pick(select: HTMLElement, label: string) {
  fireEvent.mouseDown(select.querySelector('.ant-select-selector') ?? select);
  const option = Array.from(
    document.querySelectorAll(
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option',
    ),
  ).find((o) => (o.textContent ?? '').trim() === label);
  if (!option) throw new Error(`option ${label} not offered`);
  fireEvent.click(option);
}

afterEach(() => vi.restoreAllMocks());

describe('RemoteTgWebProxyTab', () => {
  it('deletes a node profile through the node API after confirmation', async () => {
    const post = mockHttp();
    renderWithProviders(<RemoteTgWebProxyTab nodeId={NODE} />);

    const row = await profileRow('eu');
    fireEvent.click(within(row).getByRole('button', { name: 'Delete' }));
    const confirm = await waitFor(() => {
      const el = document.querySelector('.ant-modal-confirm') as HTMLElement | null;
      if (!el) throw new Error('no confirm');
      return el;
    });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][0]).toBe(
      `/panel/api/nodes/remote/${NODE}/tgWebProxy/profiles/del/eu`,
    );
  });

  it('adds a node profile to several clients’ subscriptions in one request', async () => {
    const post = mockHttp();
    renderWithProviders(<RemoteTgWebProxyTab nodeId={NODE} />);

    expect(screen.queryByText('fb:bob')).toBeNull();
    const row = await profileRow('eu');
    fireEvent.click(within(row).getByRole('button', { name: /Add to subscriptions/ }));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog.querySelector('.ant-select-loading')).toBeNull());
    const select = dialog.querySelector('.ant-select') as HTMLElement;
    pick(select, 'alice');
    pick(select, 'bob');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][0]).toBe('/panel/api/tgWebProxy/bindings/bindMany');
    expect(post.mock.calls[0][1]).toEqual({
      emails: ['alice', 'bob'],
      profileName: 'eu',
      dedicated: true,
      nodeId: NODE,
    });
  });
});
