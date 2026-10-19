import type { AllSetting } from '@panel/types';

export type SettingKind =
  | 'bool'
  | 'number'
  | 'text'
  | 'multiline'
  | 'secret'
  | 'select'
  | 'onoff'
  | 'language'
  | 'events'
  | 'json';

export interface SettingField {
  key: keyof AllSetting & string;
  kind: SettingKind;
  label?: string;
  prefix?: string;
  suffix?: string;
  hint?: string;
  options?: string[];
  events?: string[];
}

export interface SettingSection {
  prefix?: string;
  title?: string;
  fields: SettingField[];
}

export interface SettingCategory {
  id: string;
  title: string;
  sections: SettingSection[];
}

export type SettingsDraft = Record<string, unknown>;

const NUMERIC = /^-?\d+(\.\d+)?$/;

export function writeField(draft: SettingsDraft, field: SettingField, raw: string | boolean): SettingsDraft {
  let value: unknown = raw;
  if (field.kind === 'number' && typeof raw === 'string' && NUMERIC.test(raw.trim())) value = Number(raw.trim());
  return { ...draft, [field.key]: value };
}

export function readEvents(csv: string): string[] {
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function toggleEvent(csv: string, event: string, on: boolean): string {
  const current = readEvents(csv).filter((e, i, all) => all.indexOf(e) === i);
  if (!on) return current.filter((e) => e !== event).join(',');
  return (current.includes(event) ? current : [...current, event]).join(',');
}

function validJson(text: string): boolean {
  if (!text.trim()) return true;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

export function invalidFields(draft: SettingsDraft, fields: SettingField[]): SettingField[] {
  return fields.filter((f) => {
    const v = draft[f.key];
    if (f.kind === 'number') return typeof v !== 'number' || Number.isNaN(v);
    if (f.kind === 'json') return typeof v === 'string' && !validJson(v);
    return false;
  });
}

export function changedKeys(original: SettingsDraft, draft: SettingsDraft): string[] {
  return Object.keys(draft).filter((k) => original[k] !== draft[k]);
}

export const EVENT_LABELS: Record<string, string> = {
  'outbound.down': 'pages.settings.eventOutboundDown',
  'outbound.up': 'pages.settings.eventOutboundUp',
  'xray.crash': 'pages.settings.eventXrayCrash',
  'node.down': 'pages.settings.eventNodeDown',
  'node.up': 'pages.settings.eventNodeUp',
  'cpu.high': 'pages.settings.eventCPUHigh',
  'memory.high': 'pages.settings.eventMemoryHigh',
  'login.attempt': 'pages.settings.eventLoginAttempt',
};

const capital = (key: string) => key[0].toUpperCase() + key.slice(1);

// The panel redacts secrets: has<Key> says one is stored, clear<Key> wipes it on save.
export const secretConfiguredFlag = (key: string) => `has${capital(key)}`;
export const secretClearFlag = (key: string) => `clear${capital(key)}`;
