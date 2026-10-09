import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Select, Space, Switch, Typography } from 'antd';

import {
  useTgWebProxyBindingMutations,
  useTgWebProxyBindings,
  useTgWebProxySnapshot,
} from '@/api/queries/useTgWebProxy';
import { isManagedProfile } from '@/lib/tgWebProxy';

function Editor({ email }: { email: string }) {
  const { t } = useTranslation();
  const bindings = useTgWebProxyBindings();
  const snapshot = useTgWebProxySnapshot();
  const { bindClient, unbindClient, pending } = useTgWebProxyBindingMutations();

  const binding = bindings.data?.bindings.find(
    (b) => b.email.toLowerCase() === email.toLowerCase(),
  );
  const [draft, setDraft] = useState<{ profile?: string; dedicated?: boolean }>({});
  const profile = 'profile' in draft ? draft.profile : binding?.profileName;
  const dedicated = draft.dedicated ?? binding?.dedicated ?? false;

  const options = (snapshot.data?.profiles ?? [])
    .filter((p) => !isManagedProfile(p.name))
    .map((p) => ({ value: p.name, label: p.name }));

  if (snapshot.data && !snapshot.data.configExists) {
    return <Alert type="info" showIcon message={t('pages.tgWebProxy.bindings.notConfigured')} />;
  }

  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <Select
        allowClear
        style={{ width: '100%' }}
        loading={snapshot.isLoading}
        value={profile}
        options={options}
        placeholder={t('pages.tgWebProxy.bindings.selectProfile')}
        onChange={(value) => setDraft((d) => ({ ...d, profile: value }))}
      />
      <Space align="center">
        <Switch
          checked={dedicated}
          onChange={(value) => setDraft((d) => ({ ...d, dedicated: value }))}
        />
        <span>{t('pages.tgWebProxy.bindings.dedicated')}</span>
      </Space>
      <Typography.Text type="secondary">
        {t('pages.tgWebProxy.bindings.dedicatedHint')}
      </Typography.Text>
      {binding && (
        <Typography.Text type="secondary">
          {t('pages.tgWebProxy.bindings.effective')}:{' '}
          <Typography.Text code>{binding.effectiveProfile}</Typography.Text>
        </Typography.Text>
      )}
      {binding?.secret && (
        <Typography.Text type="secondary">
          {t('pages.tgWebProxy.bindings.secret')}:{' '}
          <Typography.Text code copyable>
            {binding.secret}
          </Typography.Text>
        </Typography.Text>
      )}
      {binding?.link && (
        <Typography.Text type="secondary">
          {t('pages.tgWebProxy.bindings.link')}:{' '}
          <Typography.Text copyable={{ text: binding.link }} ellipsis style={{ maxWidth: '100%' }}>
            {binding.link}
          </Typography.Text>
        </Typography.Text>
      )}
      {bindings.data?.syncError && (
        <Alert
          type="error"
          showIcon
          message={t('pages.tgWebProxy.bindings.syncError', { error: bindings.data.syncError })}
        />
      )}
      <Space>
        <Button
          type="primary"
          disabled={!profile}
          loading={pending}
          onClick={async () => {
            if (!profile) return;
            await bindClient({ email, profileName: profile, dedicated });
            setDraft({});
          }}
        >
          {t('pages.tgWebProxy.bindings.bind')}
        </Button>
        {binding && (
          <Button danger loading={pending} onClick={async () => void (await unbindClient(email))}>
            {t('pages.tgWebProxy.bindings.unbind')}
          </Button>
        )}
      </Space>
    </Space>
  );
}

export default function ClientTgWebProxySection({ email }: { email?: string }) {
  const { t } = useTranslation();
  return (
    <div>
      <Typography.Paragraph type="secondary" style={{ marginTop: 4 }}>
        {t('pages.tgWebProxy.bindings.hint')}
      </Typography.Paragraph>
      {email ? (
        <Editor key={email} email={email} />
      ) : (
        <Typography.Text type="secondary">
          {t('pages.tgWebProxy.bindings.saveFirst')}
        </Typography.Text>
      )}
    </div>
  );
}
