import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { getPref, setPref } from '@/prefs';
import { resolveLanguage, translate, type Lang } from './translate';

export { LANGUAGES, RTL_LANGS, type Lang } from './translate';

const KEY = 'we1ssboard.lang';
const deviceLang = resolveLanguage(Intl.DateTimeFormat().resolvedOptions().locale);

type T = (key: string, vars?: Record<string, string | number>) => string;

interface I18nState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: T;
}

const Ctx = createContext<I18nState | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(deviceLang);

  useEffect(() => {
    getPref(KEY)
      .then((saved) => saved && setLangState(resolveLanguage(saved)))
      .catch(() => undefined);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    void setPref(KEY, next);
  }, []);

  const value = useMemo<I18nState>(
    () => ({ lang, setLang, t: (key, vars) => translate(lang, key, vars) }),
    [lang, setLang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside I18nProvider');
  return v;
}

export function useT(): T {
  return useI18n().t;
}
