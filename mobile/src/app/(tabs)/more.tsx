import { useQuery } from '@tanstack/react-query';

import { Badge, Button, Card, ErrorCard, Muted, Row, Screen, Title } from '@/components/ui';
import { t } from '@/i18n';
import { useApi, useSession } from '@/session';

const isManaged = (name: string) => name.startsWith('fb:');

export default function More() {
  const api = useApi();
  const { session, signOut } = useSession();
  const status = useQuery({ queryKey: ['webProxy', 'status'], queryFn: api.webProxyStatus });
  const installed = !!status.data?.binaryInstalled && !!status.data.configExists;
  const config = useQuery({ queryKey: ['webProxy', 'config'], queryFn: api.webProxyConfig, enabled: installed });
  const bindings = useQuery({
    queryKey: ['webProxy', 'bindings'],
    queryFn: api.webProxyBindings,
    enabled: installed,
  });
  const boundTo = (name: string) =>
    (bindings.data?.bindings ?? []).filter((b) => b.nodeId == null && b.profileName === name).length;

  return (
    <Screen
      refreshing={status.isRefetching}
      onRefresh={() => {
        void status.refetch();
        void config.refetch();
        void bindings.refetch();
      }}
    >
      <Card>
        <Title>{t.more.webProxy}</Title>
        {status.error && <ErrorCard error={status.error} />}
        {status.data && !installed && <Muted>{t.more.notInstalled}</Muted>}
        {installed && (
          <>
            <Row label="Host" value={status.data?.hostname ?? ''} />
            <Muted>{t.more.profiles}</Muted>
            {(config.data?.profiles ?? [])
              .filter((pr) => !isManaged(pr.name))
              .map((pr) => (
                <Row
                  key={pr.name}
                  label={`${pr.name} · ${pr.carrier_mode || 'https'}`}
                  value={<Badge text={`${t.more.boundClients}: ${boundTo(pr.name)}`} tone="muted" />}
                />
              ))}
          </>
        )}
      </Card>
      <Card>
        <Title>{t.more.panel}</Title>
        <Muted>{session?.baseUrl}</Muted>
        <Button title={t.more.signOut} kind="danger" onPress={() => void signOut()} />
      </Card>
    </Screen>
  );
}
