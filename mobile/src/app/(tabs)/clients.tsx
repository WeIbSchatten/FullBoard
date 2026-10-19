import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert, FlatList, Pressable, TextInput, View } from 'react-native';
import type { ClientSlim } from '@panel/types';

import { Chips } from '@/components/Pickers';
import { Field } from '@/components/form';
import { Badge, Body, Button, Card, ErrorCard, Meter, Muted, Title } from '@/components/ui';
import type { ClientFilter } from '@/api/panel';
import { clientState } from '@/lib/clientState';
import { formatBytes, quotaUsage } from '@/lib/format';
import { CLIENT_STATE_TONE, clientStateLabel, expiryLabel } from '@/lib/labels';
import { useT } from '@/i18n';
import { useApi } from '@/session';
import { usePalette } from '@/theme';

type FilterChoice = 'all' | ClientFilter;

function ClientRow({
  c,
  selected,
  selecting,
  onPress,
  onLongPress,
}: {
  c: ClientSlim;
  selected: boolean;
  selecting: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const t = useT();
  const p = usePalette();
  const usage = quotaUsage(c.totalGB, c.traffic);
  const state = clientState(c, c.traffic);
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress}>
      <Card style={selected ? { borderColor: p.accent, borderWidth: 2 } : undefined}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Body>
              {selecting ? (selected ? '☑ ' : '☐ ') : ''}
              {c.email}
            </Body>
            {!!(c.comment || c.group) && (
              <Muted numberOfLines={1}>{[c.group && `#${c.group}`, c.comment].filter(Boolean).join(' · ')}</Muted>
            )}
          </View>
          <Badge text={clientStateLabel(t, state)} tone={CLIENT_STATE_TONE[state]} />
        </View>
        <Muted>
          {formatBytes(usage.used)} / {usage.total ? formatBytes(usage.total) : t('unlimited')} ·{' '}
          {expiryLabel(t, c.expiryTime)}
        </Muted>
        {usage.ratio !== null && <Meter ratio={usage.ratio} />}
      </Card>
    </Pressable>
  );
}

function BulkBar({ emails, onDone }: { emails: string[]; onDone: () => void }) {
  const api = useApi();
  const t = useT();
  const qc = useQueryClient();
  const groups = useQuery({ queryKey: ['groups'], queryFn: api.groups });
  const [groupName, setGroupName] = useState('');
  const [grouping, setGrouping] = useState(false);
  const run = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['clients'] });
      void qc.invalidateQueries({ queryKey: ['groups'] });
      onDone();
    },
  });
  const count = emails.length;
  const confirm = (title: string, body: string, action: () => Promise<unknown>, destructive = false) =>
    Alert.alert(title, body, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('sure'), style: destructive ? 'destructive' : 'default', onPress: () => run.mutate(action) },
    ]);

  return (
    <Card>
      <Title>{t('pages.clients.selectedCount', { count })}</Title>
      {run.error && <ErrorCard error={run.error} />}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button
          title={t('enable')}
          onPress={() =>
            confirm(t('pages.clients.bulkEnableConfirmTitle', { count }), t('pages.clients.bulkEnableConfirmContent'), () =>
              api.setClientsEnabled(emails, true),
            )
          }
        />
        <Button
          title={t('disabled')}
          onPress={() =>
            confirm(t('pages.clients.bulkDisableConfirmTitle', { count }), t('pages.clients.bulkDisableConfirmContent'), () =>
              api.setClientsEnabled(emails, false),
            )
          }
        />
        <Button
          title={t('pages.groups.resetTraffic')}
          onPress={() =>
            confirm(t('pages.groups.resetTraffic'), t('pages.inbounds.resetTrafficContent'), () => api.bulkResetTraffic(emails))
          }
        />
        <Button title={t('pages.clients.addToGroup')} onPress={() => setGrouping((v) => !v)} />
        <Button
          title={t('pages.clients.ungroup')}
          onPress={() =>
            confirm(t('pages.clients.ungroupConfirmTitle', { count }), t('pages.clients.ungroupConfirmContent'), () =>
              api.removeFromGroup(emails),
            )
          }
        />
        <Button
          title={t('delete')}
          kind="danger"
          onPress={() =>
            confirm(
              t('pages.clients.bulkDeleteConfirmTitle', { count }),
              t('pages.clients.bulkDeleteConfirmContent'),
              () => api.bulkDelete(emails),
              true,
            )
          }
        />
      </View>
      {grouping && (
        <View style={{ gap: 8 }}>
          <Field label={t('pages.clients.groupName')} value={groupName} onChange={setGroupName} />
          {!!groups.data?.length && (
            <Chips
              options={groups.data.map((g) => ({ value: g.name, label: g.name }))}
              value={groupName}
              onChange={setGroupName}
            />
          )}
          <Button
            title={t('pages.clients.addToGroup')}
            kind="primary"
            disabled={!groupName.trim()}
            busy={run.isPending}
            onPress={() => run.mutate(() => api.addToGroup(emails, groupName.trim()))}
          />
        </View>
      )}
      <Button title={t('cancel')} onPress={onDone} />
    </Card>
  );
}

export default function Clients() {
  const api = useApi();
  const p = usePalette();
  const t = useT();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterChoice>('all');
  const [group, setGroup] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const groups = useQuery({ queryKey: ['groups'], queryFn: api.groups });
  const query = useInfiniteQuery({
    queryKey: ['clients', search, filter, group],
    queryFn: ({ pageParam }) =>
      api.clients(pageParam, { search, filters: filter === 'all' ? [] : [filter], group }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.filtered ? last.page + 1 : undefined),
  });
  const items = query.data?.pages.flatMap((pg) => pg.items) ?? [];
  const summary = query.data?.pages[0]?.summary;
  const selecting = selected.length > 0;
  const toggle = (email: string) =>
    setSelected((s) => (s.includes(email) ? s.filter((e) => e !== email) : [...s, email]));

  const filters: { value: FilterChoice; label: string }[] = [
    { value: 'all', label: `${t('all')}${summary ? ` ${summary.total}` : ''}` },
    { value: 'online', label: `${t('online')}${summary ? ` ${summary.onlineCount}` : ''}` },
    { value: 'active', label: `${t('subscription.active')}${summary ? ` ${summary.active}` : ''}` },
    { value: 'deactive', label: `${t('disabled')}${summary ? ` ${summary.deactiveCount}` : ''}` },
    { value: 'depleted', label: `${t('depleted')}${summary ? ` ${summary.depletedCount}` : ''}` },
    { value: 'expiring', label: `${t('depletingSoon')}${summary ? ` ${summary.expiringCount}` : ''}` },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <FlatList
        data={items}
        keyExtractor={(c) => c.email}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
        onEndReached={() => query.hasNextPage && void query.fetchNextPage()}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 2 }}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t('pages.clients.searchPlaceholder')}
              placeholderTextColor={p.text3}
              autoCapitalize="none"
              style={{
                color: p.text,
                backgroundColor: p.surface,
                borderColor: p.border,
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 12,
                minHeight: 44,
              }}
            />
            <Chips options={filters} value={filter} onChange={setFilter} />
            {!!groups.data?.length && (
              <Chips
                options={[
                  { value: '', label: `${t('all')} · ${t('menu.groups')}` },
                  ...groups.data.map((g) => ({ value: g.name, label: `#${g.name} ${g.clientCount}` })),
                ]}
                value={group}
                onChange={setGroup}
              />
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button title={t('pages.clients.addClient')} kind="primary" onPress={() => router.push('/client/new')} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title={t('menu.groups')} onPress={() => router.push('/groups')} />
              </View>
            </View>
            {selecting && <BulkBar emails={selected} onDone={() => setSelected([])} />}
            {query.error && <ErrorCard error={query.error} onRetry={() => void query.refetch()} />}
          </View>
        }
        ListEmptyComponent={query.isLoading ? undefined : <Muted>{t('noData')}</Muted>}
        renderItem={({ item }) => (
          <ClientRow
            c={item}
            selected={selected.includes(item.email)}
            selecting={selecting}
            onLongPress={() => toggle(item.email)}
            onPress={() =>
              selecting
                ? toggle(item.email)
                : router.push({ pathname: '/client/[email]', params: { email: item.email } })
            }
          />
        )}
      />
    </View>
  );
}
