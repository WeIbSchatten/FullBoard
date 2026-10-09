import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

// Required for `output: 'export'` — the search index is fully static.
export const revalidate = false;
export const dynamic = 'force-static';

// Locales map to zbsearch's English tokenizer (SUPPORTED_LANGUAGES has no Russian).
export const { staticGET: GET } = createFromSource(source, {
  localeMap: {
    en: 'english',
    ru: 'english',
  },
});
