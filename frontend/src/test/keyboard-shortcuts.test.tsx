import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';

import KeyboardShortcuts from '@/layouts/KeyboardShortcuts';
import { renderWithProviders } from './test-utils';

afterEach(() => vi.restoreAllMocks());

function press(key: string, target: Element = document.body) {
  fireEvent.keyDown(target, { key });
}

describe('KeyboardShortcuts', () => {
  it('jumps between pages with a g-prefixed sequence', () => {
    const navigate = vi.fn();
    renderWithProviders(<KeyboardShortcuts navigate={navigate} />);
    press('g');
    press('u');
    expect(navigate).toHaveBeenCalledWith('/clients');
  });

  it('focuses the page search on "/" but ignores keys typed into fields', () => {
    const navigate = vi.fn();
    renderWithProviders(
      <>
        <main className="content-main">
          <input data-page-search aria-label="page search" />
        </main>
        <KeyboardShortcuts navigate={navigate} />
      </>,
    );
    press('/');
    const search = screen.getByLabelText('page search');
    expect(document.activeElement).toBe(search);
    press('g', search);
    press('u', search);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens the shortcut sheet on "?"', async () => {
    renderWithProviders(<KeyboardShortcuts navigate={vi.fn()} />);
    press('?');
    expect(await screen.findByText('Keyboard shortcuts')).toBeTruthy();
  });
});
