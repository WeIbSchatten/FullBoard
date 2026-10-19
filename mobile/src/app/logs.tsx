import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { Text, View } from 'react-native';

import type { XrayLogQuery } from '@/api/panel';
import { Chips } from '@/components/Pickers';
import { Field, SwitchRow } from '@/components/form';
import { Button, Card, ErrorCard, Muted, Screen } from '@/components/ui';
import { useT } from '@/i18n';
import { RequireSession, useApi } from '@/session';
import { usePalette } from '@/theme';

const COUNTS = ['100', '500', '1000'] as const;
const LEVELS = ['debug', 'info', 'notice', 'warning', 'err'] as const;
const LEVEL_KEYS = { debug: 'Debug', info: 'Info', notice: 'Notice', warning: 'Warning', err: 'Error' } as const;
const EVENT_KEYS: Record<number, string> = {
  0: 'pages.index.accessDirect',
  1: 'pages.index.accessBlocked',
  2: 'pages.index.accessProxy',
};

function Mono({ children }: { children: string }) {
  const p = usePalette();
  return (
    <Text selectable style={{ color: p.text2, fontFamily: 'monospace', fontSize: 11 }}>
      {children}
    </Text>
  );
}

function PanelLogs({ count }: { count: number }) {
  const api = useApi();
  const t = useT();
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('info');
  const [syslog, setSyslog] = useState(false);
  const logs = useQuery({ queryKey: ['logs', 'panel', count, level, syslog], queryFn: () => api.panelLogs(count, level, syslog) });
  return (
    <>
      <Card>
        <Chips
          options={LEVELS.map((l) => ({ value: l, label: t(`pages.index.logLevel${LEVEL_KEYS[l]}`) }))}
          value={level}
          onChange={setLevel}
        />
        <SwitchRow label="Syslog" value={syslog} onChange={setSyslog} />
        <Button title={t('refresh')} busy={logs.isFetching} onPress={() => void logs.refetch()} />
      </Card>
      {logs.error && <ErrorCard error={logs.error} />}
      <Card>{logs.data?.length ? <Mono>{logs.data.join('\n')}</Mono> : <Muted>{t('noData')}</Muted>}</Card>
    </>
  );
}

function XrayLogs({ count }: { count: number }) {
  const api = useApi();
  const t = useT();
  const [q, setQ] = useState<XrayLogQuery>({ filter: '', showDirect: true, showBlocked: true, showProxy: true });
  const set = <K extends keyof XrayLogQuery>(k: K) => (v: XrayLogQuery[K]) => setQ((s) => ({ ...s, [k]: v }));
  const logs = useQuery({ queryKey: ['logs', 'xray', count, q], queryFn: () => api.xrayLogs(count, q) });
  return (
    <>
      <Card>
        <Field label={t('filter')} value={q.filter} onChange={set('filter')} />
        <SwitchRow label={t('pages.index.accessDirect')} value={q.showDirect} onChange={set('showDirect')} />
        <SwitchRow label={t('pages.index.accessBlocked')} value={q.showBlocked} onChange={set('showBlocked')} />
        <SwitchRow label={t('pages.index.accessProxy')} value={q.showProxy} onChange={set('showProxy')} />
        <Button title={t('refresh')} busy={logs.isFetching} onPress={() => void logs.refetch()} />
      </Card>
      {logs.error && <ErrorCard error={logs.error} />}
      {!logs.data?.length && <Muted>{t('noData')}</Muted>}
      {(logs.data ?? []).map((e, i) => (
        <View key={i} style={{ gap: 2 }}>
          <Mono>
            {[
              e.DateTime ? new Date(e.DateTime).toLocaleTimeString() : '',
              EVENT_KEYS[e.Event ?? -1] ? t(EVENT_KEYS[e.Event ?? -1]) : '',
              e.Email ?? '',
              `${e.FromAddress ?? ''} → ${e.ToAddress ?? ''}`,
              `${e.Inbound ?? ''} → ${e.Outbound ?? ''}`,
            ]
              .filter(Boolean)
              .join('  ')}
          </Mono>
        </View>
      ))}
    </>
  );
}

function LogsScreen() {
  const t = useT();
  const [source, setSource] = useState<'panel' | 'xray'>('panel');
  const [count, setCount] = useState<(typeof COUNTS)[number]>('100');
  return (
    <Screen>
      <Stack.Screen options={{ title: t('pages.index.logs') }} />
      <Chips
        options={[
          { value: 'panel', label: t('pages.index.logs') },
          { value: 'xray', label: t('pages.index.accessLogs') },
        ]}
        value={source}
        onChange={setSource}
      />
      <Chips options={COUNTS.map((c) => ({ value: c, label: c }))} value={count} onChange={setCount} />
      {source === 'panel' ? <PanelLogs count={Number(count)} /> : <XrayLogs count={Number(count)} />}
    </Screen>
  );
}

export default function LogsRoute() {
  return (
    <RequireSession>
      <LogsScreen />
    </RequireSession>
  );
}
