const DOCS_SITE = 'https://weibschatten.github.io/We1ssBoard';

// The docs site is published in English and Russian; other panel languages get English.
export function docsUrl(language: string | undefined): string {
  return language?.toLowerCase().startsWith('ru') ? `${DOCS_SITE}/ru/docs/` : `${DOCS_SITE}/docs/`;
}
