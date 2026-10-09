import { defineI18n } from 'fumadocs-core/i18n';

// Directory-based i18n: content lives in `content/docs/{locale}/...`.
// `fallbackLanguage` defaults to `defaultLanguage` ('en'), so untranslated
// pages transparently serve English instead of 404ing.
export const i18n = defineI18n({
  defaultLanguage: 'en',
  languages: ['en', 'ru'],
  parser: 'dir',
  // English keeps canonical `/docs/...`; other locales are prefixed `/ru/...`.
  hideLocale: 'default-locale',
});

export type Locale = (typeof i18n.languages)[number];

// Display names for the language switcher (in their own script).
export const locales: { locale: Locale; name: string }[] = [
  { locale: 'en', name: 'English' },
  { locale: 'ru', name: 'Русский' },
];

export function localeDirection(_locale: string): 'rtl' | 'ltr' {
  return 'ltr';
}
