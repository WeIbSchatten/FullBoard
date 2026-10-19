import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, ErrorCard, Muted } from '@/components/ui';
import { serializeConfig } from '@/lib/xrayConfig';
import { useT } from '@/i18n';
import { useApi } from '@/session';
import { useXrayDraft, xrayDraft } from '@/xrayDraft';

// Loads the template into the shared draft and returns it with the template metadata.
export function useXrayTemplate() {
  const api = useApi();
  const template = useQuery({ queryKey: ['xrayTemplate'], queryFn: api.xrayTemplate });
  const draft = useXrayDraft();
  useEffect(() => {
    if (template.data) {
      try {
        xrayDraft.load(template.data.xraySetting);
      } catch {
        // parseConfig error surfaces through draft.cfg staying null
      }
    }
  }, [template.data]);
  return { template, draft };
}

export function XraySaveBar() {
  const api = useApi();
  const t = useT();
  const qc = useQueryClient();
  const { template, draft } = useXrayTemplate();
  const save = useMutation({
    mutationFn: () => api.saveXrayTemplate(serializeConfig(draft.cfg ?? {}), template.data?.outboundTestUrl ?? ''),
    onSuccess: () => {
      xrayDraft.saved();
      void qc.invalidateQueries({ queryKey: ['xrayTemplate'] });
    },
  });
  const restart = useMutation({ mutationFn: api.restartXray });
  if (!draft.dirty && !save.isSuccess) return null;
  return (
    <Card>
      {(save.error || restart.error) && <ErrorCard error={save.error ?? restart.error} />}
      {draft.dirty ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button title={t('pages.xray.save')} kind="primary" busy={save.isPending} onPress={() => save.mutate()} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title={t('cancel')}
              onPress={() => {
                xrayDraft.discard();
                void template.refetch();
              }}
            />
          </View>
        </View>
      ) : (
        <>
          <Muted>{restart.isSuccess ? t('pages.xray.restartSuccess') : t('pages.index.xrayStatus')}</Muted>
          {!restart.isSuccess && (
            <Button
              title={t('pages.nodes.remote.restartXray')}
              kind="primary"
              busy={restart.isPending}
              onPress={() => restart.mutate()}
            />
          )}
        </>
      )}
    </Card>
  );
}

export function useOpenItem() {
  const router = useRouter();
  return (path: string, index: number) =>
    router.push({ pathname: '/xray/item', params: { path, index: String(index) } });
}

export function XrayLoadState() {
  const { template, draft } = useXrayTemplate();
  if (template.error) return <ErrorCard error={template.error} onRetry={() => void template.refetch()} />;
  if (template.data && !draft.cfg) return <ErrorCard error={new Error('xraySetting: invalid JSON')} />;
  return null;
}
