import { hasKey } from '@/i18n/translate';

import {
  EVENT_LABELS,
  changedKeys,
  invalidFields,
  readEvents,
  toggleEvent,
  writeField,
  type SettingField,
} from './settingsModel';
import { SETTING_CATEGORIES } from './settingsSchema';

const port: SettingField = { key: 'webPort', kind: 'number', label: 'pages.settings.panelPort' };
const mux: SettingField = { key: 'subJsonMux', kind: 'json', label: 'pages.settings.mux' };
const events: SettingField = { key: 'tgEnabledEvents', kind: 'events', label: 'pages.settings.notifications' };

describe('writeField', () => {
  it('stores a typed number for numeric input and keeps unparsable text for validation', () => {
    expect(writeField({ webPort: 2053 }, port, '8443')).toEqual({ webPort: 8443 });
    expect(writeField({ webPort: 2053 }, port, '84a')).toEqual({ webPort: '84a' });
  });

  it('leaves other keys untouched', () => {
    expect(writeField({ webPort: 1, subEnable: true }, port, '2')).toEqual({ webPort: 2, subEnable: true });
  });
});

describe('events', () => {
  it('adds and removes an event without duplicates, keeping order', () => {
    expect(toggleEvent('xray.crash,node.down', 'cpu.high', true)).toBe('xray.crash,node.down,cpu.high');
    expect(toggleEvent('xray.crash,node.down', 'xray.crash', true)).toBe('xray.crash,node.down');
    expect(toggleEvent('xray.crash,node.down', 'xray.crash', false)).toBe('node.down');
    expect(toggleEvent('node.down', 'node.down', false)).toBe('');
  });

  it('reads a csv with stray spaces and empty items', () => {
    expect(readEvents(' xray.crash, ,node.up ')).toEqual(['xray.crash', 'node.up']);
  });

  it('round-trips through writeField on an events field', () => {
    expect(writeField({ tgEnabledEvents: 'a' }, events, 'a,b')).toEqual({ tgEnabledEvents: 'a,b' });
  });
});

describe('invalidFields', () => {
  it('flags broken JSON and non-numeric numbers, accepts empty JSON', () => {
    const draft = { webPort: '84a', subJsonMux: '{"enabled": tru' };
    expect(invalidFields(draft, [port, mux]).map((f) => f.key)).toEqual(['webPort', 'subJsonMux']);
    expect(invalidFields({ webPort: 1, subJsonMux: '' }, [port, mux])).toEqual([]);
  });
});

describe('changedKeys', () => {
  it('lists only keys whose value differs', () => {
    expect(changedKeys({ a: 1, b: 'x', c: true }, { a: 1, b: 'y', c: false })).toEqual(['b', 'c']);
  });
});

describe('SETTING_CATEGORIES', () => {
  it('uses only translation keys that exist in the panel dictionaries', () => {
    const refs = SETTING_CATEGORIES.flatMap((c) => [
      c.title,
      ...c.sections.flatMap((s) => [s.title, ...s.fields.flatMap((f) => [f.label, f.hint])]),
    ])
      .concat(Object.values(EVENT_LABELS))
      .filter((k): k is string => !!k);
    expect(refs.filter((k) => !hasKey(k))).toEqual([]);
  });

  it('labels every notification event a channel offers', () => {
    const events = SETTING_CATEGORIES.flatMap((c) => c.sections.flatMap((s) => s.fields.flatMap((f) => f.events ?? [])));
    expect(events.filter((e) => !EVENT_LABELS[e])).toEqual([]);
  });

  it('never lists one setting twice', () => {
    const keys = SETTING_CATEGORIES.flatMap((c) => c.sections.flatMap((s) => s.fields.map((f) => f.key)));
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
  });
});
