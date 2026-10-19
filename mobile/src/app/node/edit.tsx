import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { NodeView } from '@panel/types';

import { Field, SwitchRow } from '@/components/form';
import { Button, Card, ErrorCard, Loading, Screen } from '@/components/ui';
import { nodePayload, type NodeForm } from '@/lib/infraForms';
import { useT } from '@/i18n';
import { RequireSession, useApi } from '@/session';

function NodeEditForm({ original }: { original?: NodeView }) {
  const api = useApi();
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const [form, setForm] = useState<NodeForm>({
    name: original?.name ?? '',
    remark: original?.remark ?? '',
    address: original ? `${original.scheme}://${original.address}` : '',
    port: original ? String(original.port) : '',
    basePath: original?.basePath ?? '',
    apiToken: '',
    enable: original?.enable ?? true,
    allowPrivateAddress: original?.allowPrivateAddress ?? false,
  });
  const set = <K extends keyof NodeForm>(k: K) => (v: NodeForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const test = useMutation({ mutationFn: () => api.testNode(nodePayload(form)) });
  const save = useMutation({
    mutationFn: () => {
      const body = { ...(original ?? {}), ...nodePayload(form) };
      return original ? api.updateNode(original.id, body) : api.addNode(body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['nodes'] });
      void qc.invalidateQueries({ queryKey: ['node'] });
      router.back();
    },
  });
  return (
    <Screen>
      <Card>
        <SwitchRow label={t('pages.nodes.enable')} value={form.enable} onChange={set('enable')} onText={t('enabled')} offText={t('disabled')} />
        <Field label={t('pages.nodes.name')} value={form.name} onChange={set('name')} placeholder={t('pages.nodes.namePlaceholder')} />
        <Field label={t('pages.nodes.remark')} value={form.remark} onChange={set('remark')} />
        <Field
          label={t('pages.nodes.address')}
          value={form.address}
          onChange={set('address')}
          placeholder={t('pages.nodes.addressPlaceholder')}
          keyboard="url"
        />
        <Field label={t('pages.nodes.port')} value={form.port} onChange={set('port')} keyboard="number-pad" placeholder="2053" />
        <Field label={t('pages.nodes.basePath')} value={form.basePath} onChange={set('basePath')} placeholder="/" />
        <Field
          label={t('pages.nodes.apiToken')}
          value={form.apiToken}
          onChange={set('apiToken')}
          secure
          placeholder={t('pages.nodes.apiTokenPlaceholder')}
          hint={original ? t('pages.nodes.apiTokenKeepHint') : t('pages.nodes.apiTokenHint')}
        />
        <SwitchRow label={t('pages.nodes.allowPrivateAddress')} value={form.allowPrivateAddress} onChange={set('allowPrivateAddress')} />
      </Card>
      {(test.error || save.error) && <ErrorCard error={test.error ?? save.error} />}
      {test.isSuccess && <Card><Button title={t('pages.nodes.connectionOk')} onPress={() => test.reset()} /></Card>}
      <Button title={t('pages.nodes.testConnection')} busy={test.isPending} onPress={() => test.mutate()} />
      <Button title={t('save')} kind="primary" busy={save.isPending} onPress={() => save.mutate()} />
    </Screen>
  );
}

function NodeEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const api = useApi();
  const t = useT();
  const nodeId = id ? Number(id) : 0;
  const node = useQuery({ queryKey: ['node', nodeId], queryFn: () => api.node(nodeId), enabled: nodeId > 0 });
  if (nodeId && node.isLoading) return <Loading />;
  return (
    <>
      <Stack.Screen options={{ title: nodeId ? t('pages.nodes.editNode') : t('pages.nodes.addNode') }} />
      <NodeEditForm original={node.data} />
    </>
  );
}

export default function NodeEditRoute() {
  return (
    <RequireSession>
      <NodeEditScreen />
    </RequireSession>
  );
}
