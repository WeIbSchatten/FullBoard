import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';

import { Field } from '@/components/form';
import { Button, Card, ErrorCard, Screen } from '@/components/ui';
import { useT } from '@/i18n';
import { RequireSession, useApi } from '@/session';

function EnrollScreen() {
  const api = useApi();
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const [invite, setInvite] = useState('');
  const [name, setName] = useState('');
  const enroll = useMutation({
    mutationFn: () => api.enrollNode(invite.trim(), name.trim()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['nodes'] });
      router.back();
    },
  });
  return (
    <Screen>
      <Stack.Screen options={{ title: t('pages.nodes.addFromInvite') }} />
      <Card>
        <Field
          label={t('pages.nodes.addFromInvite')}
          value={invite}
          onChange={setInvite}
          placeholder={t('pages.nodes.invitePlaceholder')}
          hint={t('pages.nodes.inviteHint')}
          multiline
        />
        <Field label={t('pages.nodes.name')} value={name} onChange={setName} placeholder={t('pages.nodes.inviteNamePlaceholder')} />
      </Card>
      {enroll.error && <ErrorCard error={enroll.error} />}
      <Button title={t('pages.nodes.inviteSubmit')} kind="primary" disabled={!invite.trim()} busy={enroll.isPending} onPress={() => enroll.mutate()} />
    </Screen>
  );
}

export default function EnrollRoute() {
  return (
    <RequireSession>
      <EnrollScreen />
    </RequireSession>
  );
}
