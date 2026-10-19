import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { hasKey, resolveLanguage, translate } from './translate';

describe('resolveLanguage', () => {
  // Phones report BCP-47 tags with scripts and regions the panel list does not carry.
  it.each([
    ['ru-RU', 'ru-RU'],
    ['ru', 'ru-RU'],
    ['uk-UA', 'uk-UA'],
    ['zh-Hant-TW', 'zh-TW'],
    ['zh-Hans-CN', 'zh-CN'],
    ['zh-HK', 'zh-TW'],
    ['pt-PT', 'pt-BR'],
    ['fa', 'fa-IR'],
    ['de-DE', 'en-US'],
  ])('%s -> %s', (locale, want) => expect(resolveLanguage(locale)).toBe(want));
});

describe('translate', () => {
  it('reads the panel translation of the chosen language', () => {
    expect(translate('ru-RU', 'menu.clients')).toBe('Клиенты');
    expect(translate('en-US', 'menu.clients')).toBe('Clients');
  });

  it('fills single-brace variables the way the panel does', () => {
    expect(translate('en-US', 'menu.appearance.sizeAutoHint', { percent: 125 })).toBe(
      'Auto picks 125% for this screen',
    );
  });

  it('shows the key itself for a key no locale has', () => {
    expect(translate('ru-RU', 'mobile.noSuchKey')).toBe('mobile.noSuchKey');
  });
});

// A literal key the app asks for but the panel files lack would render as the bare key.
it('every literal key used by the app exists in en-US', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(name) && !name.endsWith('.test.ts')) files.push(full);
    }
  };
  walk(join(__dirname, '..'));
  const missing: string[] = [];
  for (const file of files) {
    for (const m of readFileSync(file, 'utf8').matchAll(/\bt\(\s*'([A-Za-z][\w.]*)'/g)) {
      if (!hasKey(m[1])) missing.push(`${m[1]} (${file})`);
    }
  }
  expect(missing).toEqual([]);
});
