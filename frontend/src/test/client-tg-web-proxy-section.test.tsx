import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import ClientTgWebProxySection from '@/pages/clients/ClientTgWebProxySection';
import { HttpUtil, Msg } from '@/utils';

import { renderWithProviders } from './test-utils';

const SNAPSHOT = {
  config: {},
  configExists: true,
  profilesExists: true,
  profiles: [
    { name: 'default', secret: '000102030405060708090a0b0c0d0e0f', backend: '127.0.0.1:2398' },
    { name: 'fb:bob', secret: 'ffffffffffffffffffffffffffffffff', backend: '127.0.0.1:2398' },
  ],
};

function mockHttp(bindings: unknown[]) {
  const get = vi.spyOn(HttpUtil, 'get').mockImplementation(async (url: string) => {
    if (url.endsWith('/bindings')) return new Msg(true, '', { bindings, syncError: '' });
    return new Msg(true, '', SNAPSHOT);
  });
  const post = vi.spyOn(HttpUtil, 'post').mockResolvedValue(new Msg(true, '', {}));
  return { get, post };
}

function pickOption(text: string) {
  const select = document.querySelector('.ant-select');
  if (!select) throw new Error('profile select not rendered');
  fireEvent.mouseDown(select);
  const option = Array.from(document.querySelectorAll('.ant-select-item-option')).find(
    (o) => (o.textContent ?? '').trim() === text,
  );
  if (!option) throw new Error(`option '${text}' not found`);
  fireEvent.click(option);
}

afterEach(() => vi.restoreAllMocks());

describe('ClientTgWebProxySection', () => {
  it('binds the client to the chosen profile with a dedicated secret and hides managed profiles', async () => {
    const { post } = mockHttp([]);
    renderWithProviders(<ClientTgWebProxySection email="alice" />);

    await screen.findByText('Dedicated secret');
    await waitFor(() => expect(document.querySelector('.ant-select-loading')).toBeNull());
    fireEvent.mouseDown(document.querySelector('.ant-select')!);
    const offered = Array.from(document.querySelectorAll('.ant-select-item-option')).map((o) =>
      (o.textContent ?? '').trim(),
    );
    expect(offered).toEqual(['default']);

    pickOption('default');
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByRole('button', { name: 'Bind' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][0]).toBe('/panel/api/tgWebProxy/bindings/bind');
    expect(post.mock.calls[0][1]).toEqual({
      email: 'alice',
      profileName: 'default',
      dedicated: true,
    });
  });

  it('unbinds a bound client by email', async () => {
    const { post } = mockHttp([
      {
        clientId: 1,
        email: 'Alice',
        profileName: 'default',
        dedicated: false,
        effectiveProfile: 'default',
      },
    ]);
    renderWithProviders(<ClientTgWebProxySection email="alice" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Unbind' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][0]).toBe('/panel/api/tgWebProxy/bindings/unbind');
    expect(post.mock.calls[0][1]).toEqual({ email: 'alice' });
  });

  it('asks to save a new client first and does not query the relay', () => {
    const { get } = mockHttp([]);
    renderWithProviders(<ClientTgWebProxySection />);

    expect(screen.getByText(/Save the client first/)).toBeTruthy();
    expect(get).not.toHaveBeenCalled();
  });
});
