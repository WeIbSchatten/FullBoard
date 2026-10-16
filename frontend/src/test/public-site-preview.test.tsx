import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import PublicSiteTab from '@/pages/tg-web-proxy/PublicSiteTab';
import { HttpUtil, Msg } from '@/utils';

import { renderWithProviders } from './test-utils';

const HTML = '<html><body><h1>Relay landing</h1></body></html>';

afterEach(() => vi.restoreAllMocks());

describe('PublicSiteTab preview', () => {
  // A sandbox without allow-same-origin hides contentDocument from the parent,
  // so the preview has to be handed over as srcdoc or it stays blank.
  it('renders the saved landing page into the sandboxed preview frame', async () => {
    vi.spyOn(HttpUtil, 'get').mockResolvedValue(
      new Msg(true, '', {
        active: true,
        configPublicDir: '/srv/public',
        defaultHtml: '',
        dir: '/srv/public',
        files: [],
        indexHtml: HTML,
      }),
    );
    renderWithProviders(<PublicSiteTab />);

    const frame = await screen.findByTitle('public-site-preview');
    await waitFor(() => expect(frame.getAttribute('srcdoc')).toBe(HTML));
    expect(frame.getAttribute('sandbox')).toBe('');
  });
});

describe('PublicSiteTab presets', () => {
  it('loads a built-in preset into the editor and preview without saving it', async () => {
    const post = vi.spyOn(HttpUtil, 'post');
    vi.spyOn(HttpUtil, 'get').mockResolvedValue(
      new Msg(true, '', {
        active: true,
        configPublicDir: '/srv/tproxy-site',
        defaultHtml: '',
        dir: '/srv/tproxy-site',
        files: [],
        indexHtml: HTML,
        presets: [
          { id: 'signup', html: '<html>signup</html>' },
          { id: 'cats', html: '<html>cats</html>' },
        ],
      }),
    );
    renderWithProviders(<PublicSiteTab />);

    const frame = await screen.findByTitle('public-site-preview');
    await waitFor(() => expect(frame.getAttribute('srcdoc')).toBe(HTML));
    fireEvent.mouseDown(document.querySelector('.ant-select')!);
    fireEvent.click(await screen.findByText('Cats fixing the connection'));

    await waitFor(() => expect(frame.getAttribute('srcdoc')).toBe('<html>cats</html>'));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('<html>cats</html>');
    expect(post).not.toHaveBeenCalled();
  });
});
