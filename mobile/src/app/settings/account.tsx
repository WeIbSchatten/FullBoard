import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Stack } from 'expo-router';

import { Field } from '@/components/form';
import { Button, Card, ErrorCard, Muted, Screen } from '@/components/ui';
import { useT } from '@/i18n';
import type { UserUpdate } from '@/api/panel';
import { RequireSession, useApi } from '@/session';

const EMPTY: UserUpdate = { oldUsername: '', oldPassword: '', newUsername: '', newPassword: '', twoFactorCode: '' };

function AccountScreen() {
  const api = useApi();
  const t = useT();
  const [form, setForm] = useState(EMPTY);
  const set = (k: keyof UserUpdate) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const save = useMutation({ mutationFn: () => api.updateUser(form), onSuccess: () => setForm(EMPTY) });
  return (
    <Screen>
      <Stack.Screen options={{ title: t('pages.settings.security.admin') }} />
      <Card>
        <Field label={t('pages.settings.oldUsername')} value={form.oldUsername} onChange={set('oldUsername')} />
        <Field label={t('pages.settings.currentPassword')} value={form.oldPassword} onChange={set('oldPassword')} secure />
        <Field label={t('pages.settings.newUsername')} value={form.newUsername} onChange={set('newUsername')} />
        <Field label={t('pages.settings.newPassword')} value={form.newPassword} onChange={set('newPassword')} secure />
        <Field label={t('twoFactorCode')} value={form.twoFactorCode} onChange={set('twoFactorCode')} keyboard="number-pad" />
      </Card>
      {save.error && <ErrorCard error={save.error} />}
      {save.isSuccess && <Muted>✓ {t('pages.settings.toasts.modifySettings')}</Muted>}
      <Button
        title={t('pages.settings.save')}
        kind="primary"
        disabled={!form.oldUsername || !form.oldPassword || !form.newUsername || !form.newPassword}
        busy={save.isPending}
        onPress={() => save.mutate()}
      />
    </Screen>
  );
}

export default function AccountRoute() {
  return (
    <RequireSession>
      <AccountScreen />
    </RequireSession>
  );
}
