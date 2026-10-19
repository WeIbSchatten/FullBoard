import { describe, expect, it } from 'vitest';

import { docsUrl } from '@/layouts/docsUrl';

describe('docsUrl', () => {
  it('opens the Russian docs for a Russian panel and English otherwise', () => {
    expect(docsUrl('ru-RU')).toBe('https://weibschatten.github.io/We1ssBoard/ru/docs/');
    expect(docsUrl('en-US')).toBe('https://weibschatten.github.io/We1ssBoard/docs/');
    expect(docsUrl('uk-UA')).toBe('https://weibschatten.github.io/We1ssBoard/docs/');
    expect(docsUrl(undefined)).toBe('https://weibschatten.github.io/We1ssBoard/docs/');
  });
});
