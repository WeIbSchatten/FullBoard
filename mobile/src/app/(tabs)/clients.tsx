import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import type { ClientSlim } from '@panel/types';

import { Badge, Body, Button, Card, ErrorCard, Meter, Muted } from '@/components/ui';
import { clientState } from '@/lib/clientState';
import { formatBytes, quotaUsage } from '@/lib/format';
import { CLIENT_STATE_TONE, clientStateLabel, expiryLabel } from '@/lib/labels';
import { useT } from '@/i18n';
import { useApi } from '@/session';
import { usePalette } from '@/theme';

function ClientRow({ c, onPress }: { c: ClientSlim; onPress: () => void }) {
  const t = useT();
  const usage = quotaUsage(c.totalGB, c.traffic);
  const state = clientState(c, c.traffic);
  return (
    <Pressable onPress={onPress}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Body>{c.email}</Body>
            {!!c.comment && <Muted numberOfLines={1}>{c.comment}</Muted>}
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

export default function Clients() {
  const api = useApi();
  const p = usePalette();
  const t = useT();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const query = useInfiniteQuery({
    queryKey: ['clients', search],
    queryFn: ({ pageParam }) => api.clients(pageParam, search),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.filtered ? last.page + 1 : undefined),
  });
  const items = query.data?.pages.flatMap((pg) => pg.items) ?? [];

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
            <Button title={t('pages.clients.addClient')} kind="primary" onPress={() => router.push('/client/new')} />
            {query.error && <ErrorCard error={query.error} onRetry={() => void query.refetch()} />}
          </View>
        }
        ListEmptyComponent={query.isLoading ? undefined : <Muted>{t('noData')}</Muted>}
        renderItem={({ item }) => (
          <ClientRow
            c={item}
            onPress={() => router.push({ pathname: '/client/[email]', params: { email: item.email } })}
          />
        )}
      />
    </View>
  );
}
