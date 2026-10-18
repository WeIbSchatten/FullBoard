import { useColorScheme } from 'react-native';

// Mirrors the panel's monochrome DreamCut tokens (frontend/src/styles/theme.css).
const dark = {
  bg: '#0a0a0a',
  surface: '#141414',
  surface2: '#1b1b1b',
  border: 'rgba(255,255,255,0.08)',
  text: '#f5f5f5',
  text2: '#b4b4b4',
  text3: '#8f8f8f',
  accent: '#f5f5f5',
  onAccent: '#0a0a0a',
  success: '#7dcea0',
  warning: '#e2b86b',
  error: '#ec7a7a',
};

const light: typeof dark = {
  bg: '#f3f3f2',
  surface: '#ffffff',
  surface2: '#f4f4f3',
  border: 'rgba(0,0,0,0.08)',
  text: '#111111',
  text2: '#4d4d4d',
  text3: '#666666',
  accent: '#111111',
  onAccent: '#ffffff',
  success: '#1f7a45',
  warning: '#8a5a10',
  error: '#b3362f',
};

export type Palette = typeof dark;

export function usePalette(): Palette {
  return useColorScheme() === 'light' ? light : dark;
}
