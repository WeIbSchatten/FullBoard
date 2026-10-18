import { afterEach, describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';

import { ThemeProvider, autoUiScale, uiZoom, useTheme } from '@/hooks/useTheme';

function Probe({ onReady }: { onReady: (v: ReturnType<typeof useTheme>) => void }) {
  onReady(useTheme());
  return null;
}

function mount() {
  let api!: ReturnType<typeof useTheme>;
  render(
    <ThemeProvider>
      <Probe onReady={(v) => (api = v)} />
    </ThemeProvider>,
  );
  return () => api;
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-style');
  document.documentElement.style.zoom = '';
});

describe('autoUiScale', () => {
  // 2K/QHD monitors at 100% OS scaling rendered the panel at laptop size (issue from 2026-10-17).
  it.each([
    [390, 1],
    [1440, 1],
    [1920, 1.1],
    [2560, 1.25],
    [3840, 1.5],
  ])('scales a %ipx wide window by %f', (width, scale) => {
    expect(autoUiScale(width)).toBe(scale);
  });
});

describe('appearance presets', () => {
  it('applies and remembers the pastel style preset', () => {
    const api = mount();
    act(() => api().setStylePreset('pastel'));
    expect(document.documentElement.getAttribute('data-style')).toBe('pastel');
    expect(localStorage.getItem('fb-style')).toBe('pastel');
    expect(api().antdThemeConfig.token?.colorPrimary).toBe('#a8a3f6');
  });

  // Colour presets pick their accent per theme: a bright one on dark, a deeper one on paper.
  it.each([
    ['ocean', '#2f74ff', '#1f5fd6'],
    ['emerald', '#34d399', '#0f7a55'],
  ] as const)('applies the %s preset with its own accent', (preset, darkAccent, lightAccent) => {
    const api = mount();
    act(() => api().setStylePreset(preset));
    expect(document.documentElement.getAttribute('data-style')).toBe(preset);
    expect(localStorage.getItem('fb-style')).toBe(preset);
    act(() => api().setMode('dark'));
    expect(api().antdThemeConfig.token?.colorPrimary).toBe(darkAccent);
    act(() => api().setMode('light'));
    expect(api().antdThemeConfig.token?.colorPrimary).toBe(lightAccent);
  });

  it('zooms the document for a fixed interface size and clears it at 100%', () => {
    const api = mount();
    act(() => api().setUiScale('125'));
    expect(uiZoom()).toBe(1.25);
    expect(localStorage.getItem('fb-ui-scale')).toBe('125');
    act(() => api().setUiScale('100'));
    expect(uiZoom()).toBe(1);
  });
});
