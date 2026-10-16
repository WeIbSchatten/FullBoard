import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

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
