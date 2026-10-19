import arEG from '../../../internal/web/translation/ar-EG.json';
import enUS from '../../../internal/web/translation/en-US.json';
import esES from '../../../internal/web/translation/es-ES.json';
import faIR from '../../../internal/web/translation/fa-IR.json';
import idID from '../../../internal/web/translation/id-ID.json';
import jaJP from '../../../internal/web/translation/ja-JP.json';
import ptBR from '../../../internal/web/translation/pt-BR.json';
import ruRU from '../../../internal/web/translation/ru-RU.json';
import trTR from '../../../internal/web/translation/tr-TR.json';
import ukUA from '../../../internal/web/translation/uk-UA.json';
import viVN from '../../../internal/web/translation/vi-VN.json';
import zhCN from '../../../internal/web/translation/zh-CN.json';
import zhTW from '../../../internal/web/translation/zh-TW.json';

// Same list and names as the panel's LanguageManager (frontend/src/utils/index.ts).
export const LANGUAGES = [
  { value: 'ar-EG', name: 'العربية' },
  { value: 'en-US', name: 'English' },
  { value: 'fa-IR', name: 'فارسی' },
  { value: 'zh-CN', name: '简体中文' },
  { value: 'zh-TW', name: '繁體中文' },
  { value: 'ja-JP', name: '日本語' },
  { value: 'ru-RU', name: 'Русский' },
  { value: 'vi-VN', name: 'Tiếng Việt' },
  { value: 'es-ES', name: 'Español' },
  { value: 'id-ID', name: 'Indonesian' },
  { value: 'uk-UA', name: 'Український' },
  { value: 'tr-TR', name: 'Türkçe' },
  { value: 'pt-BR', name: 'Português' },
] as const;

export type Lang = (typeof LANGUAGES)[number]['value'];
type Dict = { [key: string]: string | Dict };

const DICTS: Record<Lang, Dict> = {
  'ar-EG': arEG,
  'en-US': enUS,
  'es-ES': esES,
  'fa-IR': faIR,
  'id-ID': idID,
  'ja-JP': jaJP,
  'pt-BR': ptBR,
  'ru-RU': ruRU,
  'tr-TR': trTR,
  'uk-UA': ukUA,
  'vi-VN': viVN,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
};

export const RTL_LANGS: readonly Lang[] = ['ar-EG', 'fa-IR'];

export function resolveLanguage(locale: string): Lang {
  const tag = locale.replace('_', '-');
  const exact = LANGUAGES.find((l) => l.value.toLowerCase() === tag.toLowerCase());
  if (exact) return exact.value;
  const [base, ...rest] = tag.toLowerCase().split('-');
  if (base === 'zh') {
    const traditional = rest.some((p) => ['hant', 'tw', 'hk', 'mo'].includes(p));
    return traditional ? 'zh-TW' : 'zh-CN';
  }
  return LANGUAGES.find((l) => l.value.toLowerCase().startsWith(`${base}-`))?.value ?? 'en-US';
}

function lookup(dict: Dict, key: string): string | undefined {
  let node: string | Dict | undefined = dict;
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export function hasKey(key: string): boolean {
  return lookup(DICTS['en-US'], key) !== undefined;
}

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const text = lookup(DICTS[lang], key) ?? lookup(DICTS['en-US'], key) ?? key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}
