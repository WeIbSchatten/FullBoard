import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, View } from 'react-native';

import { Chips } from '@/components/Pickers';
import { Field, SwitchRow } from '@/components/form';
import { Button, Card, ErrorCard, Loading, Muted, Title } from '@/components/ui';
import { LANGUAGES, useT } from '@/i18n';
import { hasKey } from '@/i18n/translate';
import {
  EVENT_LABELS,
  changedKeys,
  invalidFields,
  readEvents,
  secretClearFlag,
  secretConfiguredFlag,
  toggleEvent,
  writeField,
  type SettingCategory,
  type SettingField,
  type SettingsDraft,
} from '@/lib/settingsModel';

type T = ReturnType<typeof useT>;

export function fieldLabel(t: T, f: SettingField): string {
  return `${f.prefix ?? ''}${f.label ? t(f.label) : ''}${f.suffix ? `, ${f.suffix}` : ''}`;
}

function sectionTitle(t: T, prefix?: string, title?: string): string {
  return `${prefix ?? ''}${title ? t(title) : ''}`;
}

function SettingFieldView({
  field: f,
  draft,
  onDraft,
  invalid,
}: {
  field: SettingField;
  draft: SettingsDraft;
  onDraft: (d: SettingsDraft) => void;
  invalid: boolean;
}) {
  const t = useT();
  const label = fieldLabel(t, f);
  const hint = f.hint && hasKey(f.hint) ? t(f.hint) : undefined;
  const value = draft[f.key];
  const set = (raw: string | boolean) => onDraft(writeField(draft, f, raw));
  const text = value === undefined || value === null ? '' : String(value);

  switch (f.kind) {
    case 'bool':
      return (
        <View style={{ gap: 2 }}>
          <SwitchRow label={label} value={!!value} onChange={set} onText={t('enabled')} offText={t('disabled')} />
          {!!hint && <Muted>{hint}</Muted>}
        </View>
      );
    case 'select':
    case 'onoff':
    case 'language': {
      const options =
        f.kind === 'language'
          ? LANGUAGES.map((l) => ({ value: l.value as string, label: l.name }))
          : f.kind === 'onoff'
            ? [
                { value: '', label: t('pages.settings.subIncyNotSet') },
                { value: '1', label: t('pages.settings.subIncyOn') },
                { value: '0', label: t('pages.settings.subIncyOff') },
              ]
            : (f.options ?? []).map((o) => ({ value: o, label: o || '—' }));
      return (
        <View style={{ gap: 6 }}>
          <Muted>{label}</Muted>
          <Chips options={options} value={text} onChange={set} />
          {!!hint && <Muted>{hint}</Muted>}
        </View>
      );
    }
    case 'events':
      return (
        <View style={{ gap: 6 }}>
          {(f.events ?? []).map((ev) => (
            <SwitchRow
              key={ev}
              label={t(EVENT_LABELS[ev])}
              value={readEvents(text).includes(ev)}
              onChange={(on) => set(toggleEvent(text, ev, on))}
            />
          ))}
        </View>
      );
    case 'secret': {
      const configured = !!draft[secretConfiguredFlag(f.key)];
      const clearKey = secretClearFlag(f.key);
      const clearing = !!draft[clearKey];
      return (
        <View style={{ gap: 6 }}>
          <Field
            label={label}
            value={text}
            onChange={(v) => onDraft({ ...writeField(draft, f, v), [clearKey]: false })}
            secure
            placeholder={configured && !clearing ? '••••••••' : ''}
            hint={hint}
          />
          {configured && (
            <Button
              title={clearing ? t('pages.settings.secretClearUndo') : t('pages.settings.secretClear')}
              kind={clearing ? 'danger' : 'default'}
              onPress={() => onDraft({ ...writeField(draft, f, ''), [clearKey]: !clearing })}
            />
          )}
        </View>
      );
    }
    default:
      return (
        <Field
          label={label}
          value={text}
          onChange={set}
          keyboard={f.kind === 'number' ? 'numbers-and-punctuation' : undefined}
          multiline={f.kind === 'multiline' || f.kind === 'json'}
          hint={invalid ? `⚠ ${hint ?? label}` : hint}
        />
      );
  }
}

// One settings tab of the web panel, for this panel or (via load/save) a remote node.
export function SettingsEditor({
  category,
  queryKey,
  load,
  save,
  restart,
  actions,
}: {
  category: SettingCategory;
  queryKey: unknown[];
  load: () => Promise<SettingsDraft>;
  save: (body: SettingsDraft) => Promise<unknown>;
  restart: () => Promise<unknown>;
  actions?: React.ReactNode;
}) {
  const t = useT();
  const qc = useQueryClient();
  const settings = useQuery({ queryKey, queryFn: load });
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const current = draft ?? settings.data ?? null;
  const fields = category.sections.flatMap((s) => s.fields);
  const invalid = current ? invalidFields(current, fields) : [];
  const dirty = !!draft && !!settings.data && changedKeys(settings.data, draft).length > 0;

  const restartMut = useMutation({ mutationFn: restart });
  const saveMut = useMutation({
    mutationFn: () => save(current!),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey });
      setDraft(null);
      Alert.alert(t('pages.settings.toasts.modifySettings'), t('pages.settings.restartPanelDesc'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('pages.settings.restartPanel'), onPress: () => restartMut.mutate() },
      ]);
    },
  });

  if (settings.isLoading) return <Loading />;
  if (settings.error) return <ErrorCard error={settings.error} onRetry={() => void settings.refetch()} />;
  if (!current) return null;

  return (
    <>
      {category.sections.map((s, i) => (
        <Card key={i}>
          {(s.prefix || s.title) && <Title>{sectionTitle(t, s.prefix, s.title)}</Title>}
          {s.fields.map((f) => (
            <SettingFieldView key={f.key} field={f} draft={current} onDraft={setDraft} invalid={invalid.includes(f)} />
          ))}
        </Card>
      ))}
      {(saveMut.error || restartMut.error) && <ErrorCard error={saveMut.error ?? restartMut.error} />}
      {invalid.length > 0 && <Muted>⚠ {invalid.map((f) => fieldLabel(t, f)).join(', ')}</Muted>}
      <Button
        title={t('pages.settings.save')}
        kind="primary"
        disabled={!dirty || invalid.length > 0}
        busy={saveMut.isPending}
        onPress={() => saveMut.mutate()}
      />
      {dirty && <Button title={t('cancel')} onPress={() => setDraft(null)} />}
      {actions}
      <Button
        title={t('pages.settings.restartPanel')}
        busy={restartMut.isPending}
        onPress={() =>
          Alert.alert(t('pages.settings.restartPanel'), t('pages.settings.restartPanelDesc'), [
            { text: t('cancel'), style: 'cancel' },
            { text: t('pages.settings.restartPanel'), style: 'destructive', onPress: () => restartMut.mutate() },
          ])
        }
      />
    </>
  );
}
