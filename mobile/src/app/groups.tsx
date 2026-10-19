import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, View } from 'react-native';

import { Field } from '@/components/form';
import { Badge, Body, Button, Card, ErrorCard, Muted, Screen, Title } from '@/components/ui';
import { useT } from '@/i18n';
import { RequireSession, useApi } from '@/session';

function GroupsScreen() {
  const api = useApi();
  const t = useT();
  const qc = useQueryClient();
  const groups = useQuery({ queryKey: ['groups'], queryFn: api.groups });
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null);
  const run = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['groups'] });
      void qc.invalidateQueries({ queryKey: ['clients'] });
      setNewName('');
      setRenaming(null);
    },
  });

  return (
    <Screen refreshing={groups.isRefetching} onRefresh={() => void groups.refetch()}>
      {(groups.error || run.error) && <ErrorCard error={groups.error ?? run.error} />}
      <Card>
        <Title>{t('pages.groups.addGroup')}</Title>
        <Field label={t('pages.clients.groupName')} value={newName} onChange={setNewName} />
        <Button
          title={t('create')}
          kind="primary"
          disabled={!newName.trim()}
          busy={run.isPending}
          onPress={() => run.mutate(() => api.createGroup(newName.trim()))}
        />
      </Card>
      {groups.data?.length === 0 && <Muted>{t('noData')}</Muted>}
      {groups.data?.map((g) => (
        <Card key={g.name}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Body>#{g.name}</Body>
            <Badge text={`${t('pages.groups.clientCount')}: ${g.clientCount}`} tone="muted" />
          </View>
          {renaming?.from === g.name ? (
            <>
              <Field
                label={t('pages.groups.renameTitle', { name: g.name })}
                value={renaming.to}
                onChange={(to) => setRenaming({ from: g.name, to })}
              />
              <Button
                title={t('save')}
                kind="primary"
                disabled={!renaming.to.trim() || renaming.to.trim() === g.name}
                onPress={() => run.mutate(() => api.renameGroup(g.name, renaming.to.trim()))}
              />
            </>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Button title={t('pages.groups.rename')} onPress={() => setRenaming({ from: g.name, to: g.name })} />
              <Button
                title={t('pages.groups.resetTraffic')}
                onPress={() =>
                  Alert.alert(t('pages.groups.resetConfirmTitle', { name: g.name }), t('pages.groups.resetConfirmContent'), [
                    { text: t('cancel'), style: 'cancel' },
                    { text: t('sure'), onPress: () => run.mutate(() => api.resetGroupTraffic(g.name)) },
                  ])
                }
              />
              <Button
                title={t('delete')}
                kind="danger"
                onPress={() =>
                  Alert.alert(t('pages.groups.deleteConfirmTitle', { name: g.name }), t('pages.groups.deleteConfirmContent', { count: g.clientCount }), [
                    { text: t('cancel'), style: 'cancel' },
                    { text: t('delete'), style: 'destructive', onPress: () => run.mutate(() => api.deleteGroup(g.name)) },
                  ])
                }
              />
            </View>
          )}
        </Card>
      ))}
    </Screen>
  );
}

export default function GroupsRoute() {
  return (
    <RequireSession>
      <GroupsScreen />
    </RequireSession>
  );
}
