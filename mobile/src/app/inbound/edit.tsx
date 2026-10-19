import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import type { Inbound } from '@panel/types';

import { Chips } from '@/components/Pickers';
import { Field, SwitchRow } from '@/components/form';
import { Button, Card, ErrorCard, Loading, Muted, Screen, Title } from '@/components/ui';
import {
  NETWORKS,
  PROTOCOLS,
  STREAM_PROTOCOLS,
  allowedSecurities,
  draftFromInbound,
  getPath,
  newDraft,
  payloadFromDraft,
  setNetwork,
  setPath,
  setSecurity,
  type InboundDraft,
  type Security,
} from '@/lib/inboundDraft';
import { deviceRandom } from '@/lib/random';
import { useT } from '@/i18n';
import { RequireSession, useApi } from '@/session';
import { usePalette } from '@/theme';

const csv = (v: unknown) => (Array.isArray(v) ? v.join(', ') : '');
const fromCsv = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
const str = (v: unknown) => (typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v));

// Edits one JSON section as text; Apply replaces the section only when it parses.
function JsonSection({
  title,
  value,
  onApply,
}: {
  title: string;
  value: Record<string, unknown>;
  onApply: (v: Record<string, unknown>) => void;
}) {
  const t = useT();
  const p = usePalette();
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState('');
  const shown = text ?? JSON.stringify(value, null, 2);
  return (
    <View style={{ gap: 6 }}>
      <Field label={title} value={shown} onChange={setText} multiline />
      {!!error && <Text style={{ color: p.error }}>{error}</Text>}
      {text !== null && (
        <Button
          title={t('pages.xray.geoBrowser.apply')}
          onPress={() => {
            try {
              const parsed = JSON.parse(text) as unknown;
              if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('{ … }');
              onApply(parsed as Record<string, unknown>);
              setText(null);
              setError('');
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          }}
        />
      )}
    </View>
  );
}

function InboundForm({ original }: { original?: Inbound }) {
  const api = useApi();
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<InboundDraft>(() =>
    original ? draftFromInbound(original) : newDraft('vless', deviceRandom),
  );
  const set = (path: string) => (v: unknown) => setDraft((d) => setPath(d, path, v));
  const keys = useMutation({ mutationFn: api.x25519 });

  const save = useMutation({
    mutationFn: async () => {
      const body = payloadFromDraft(draft, original as unknown as Record<string, unknown> | undefined);
      return original ? api.updateInbound(original.id, body) : api.addInbound(body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inbounds'] });
      void qc.invalidateQueries({ queryKey: ['inbound'] });
      router.back();
    },
  });

  const stream = draft.streamSettings;
  const network = str(getPath(stream, 'network')) || 'tcp';
  const security = str(getPath(stream, 'security')) || 'none';
  const net = `streamSettings.${network}Settings`;
  const streamed = STREAM_PROTOCOLS.includes(draft.protocol);

  const applyReality = async () => {
    const pair = await keys.mutateAsync();
    setDraft((d) => setSecurity(d, 'reality', deviceRandom, pair));
  };

  return (
    <Screen>
      {!original && (
        <Card>
          <Title>{t('protocol')}</Title>
          <Chips
            options={PROTOCOLS.map((p) => ({ value: p, label: p }))}
            value={draft.protocol as (typeof PROTOCOLS)[number]}
            onChange={(protocol) => setDraft((d) => ({ ...newDraft(protocol, deviceRandom), port: d.port, remark: d.remark === d.protocol ? protocol : d.remark }))}
          />
        </Card>
      )}
      <Card>
        <SwitchRow label={t('enable')} value={draft.enable} onChange={set('enable')} onText={t('enabled')} offText={t('disabled')} />
        <Field label={t('remark')} value={draft.remark} onChange={set('remark')} />
        <Field label={t('pages.inbounds.port')} value={draft.port} onChange={set('port')} keyboard="number-pad" />
        <Field label={t('monitor')} value={draft.listen} onChange={set('listen')} placeholder="0.0.0.0" />
        <Field
          label={`${t('pages.inbounds.totalFlow')} (GB)`}
          value={draft.totalGB}
          onChange={set('totalGB')}
          keyboard="decimal-pad"
          hint={t('pages.inbounds.meansNoLimit')}
        />
        <Field
          label={t('pages.inbounds.expireDate')}
          value={draft.expiryDays}
          onChange={set('expiryDays')}
          keyboard="number-pad"
          hint={t('pages.inbounds.leaveBlankToNeverExpire')}
        />
      </Card>

      {draft.protocol === 'shadowsocks' && (
        <Card>
          <Field label={t('pages.inbounds.form.encryptionMethod')} value={str(getPath(draft.settings, 'method'))} onChange={set('settings.method')} />
          <Field label={t('password')} value={str(getPath(draft.settings, 'password'))} onChange={set('settings.password')} />
        </Card>
      )}
      {draft.protocol === 'mtproto' && (
        <Card>
          <Field
            label={t('pages.inbounds.form.fakeTlsDomain')}
            value={str(getPath(draft.settings, 'fakeTlsDomain'))}
            onChange={set('settings.fakeTlsDomain')}
            hint={t('pages.inbounds.form.mtprotoFakeTlsDomainHint')}
          />
        </Card>
      )}

      {streamed && (
        <Card>
          <Title>{t('pages.inbounds.streamTab')}</Title>
          <Chips
            options={NETWORKS.map((n) => ({ value: n, label: n }))}
            value={network as (typeof NETWORKS)[number]}
            onChange={(n) => setDraft((d) => setNetwork(d, n))}
          />
          {['ws', 'httpupgrade', 'xhttp'].includes(network) && (
            <>
              <Field label={t('path')} value={str(getPath(draft, `${net}.path`))} onChange={set(`${net}.path`)} />
              <Field label={t('host')} value={str(getPath(draft, `${net}.host`))} onChange={set(`${net}.host`)} />
            </>
          )}
          {network === 'xhttp' && (
            <Chips
              options={['auto', 'packet-up', 'stream-up', 'stream-one'].map((m) => ({ value: m, label: m }))}
              value={str(getPath(draft, `${net}.mode`)) || 'auto'}
              onChange={set(`${net}.mode`)}
            />
          )}
          {network === 'grpc' && (
            <Field
              label={t('pages.inbounds.form.serviceName')}
              value={str(getPath(draft, `${net}.serviceName`))}
              onChange={set(`${net}.serviceName`)}
            />
          )}

          <Title>{t('pages.inbounds.securityTab')}</Title>
          <Chips
            options={allowedSecurities(draft.protocol, network).map((s) => ({ value: s, label: s }))}
            value={security as Security}
            onChange={(s) => (s === 'reality' ? void applyReality() : setDraft((d) => setSecurity(d, s, deviceRandom)))}
          />
          {keys.error && <ErrorCard error={keys.error} />}
          {security === 'tls' && (
            <>
              <Field
                label={t('pages.hosts.fields.sni')}
                value={str(getPath(stream, 'tlsSettings.serverName'))}
                onChange={set('streamSettings.tlsSettings.serverName')}
              />
              <Field
                label={`${t('certificate')} · ${t('pages.inbounds.certificatePath')}`}
                value={str(getPath(stream, 'tlsSettings.certificates.0.certificateFile'))}
                onChange={(v) =>
                  setDraft((d) => {
                    const certs = (getPath(d.streamSettings, 'tlsSettings.certificates') as Record<string, unknown>[]) ?? [{}];
                    return setPath(d, 'streamSettings.tlsSettings.certificates', [{ ...certs[0], certificateFile: v }, ...certs.slice(1)]);
                  })
                }
              />
              <Field
                label={`${t('pages.inbounds.privatekey')} · ${t('pages.inbounds.certificatePath')}`}
                value={str(getPath(stream, 'tlsSettings.certificates.0.keyFile'))}
                onChange={(v) =>
                  setDraft((d) => {
                    const certs = (getPath(d.streamSettings, 'tlsSettings.certificates') as Record<string, unknown>[]) ?? [{}];
                    return setPath(d, 'streamSettings.tlsSettings.certificates', [{ ...certs[0], keyFile: v }, ...certs.slice(1)]);
                  })
                }
              />
              <Field
                label={t('pages.hosts.fields.alpn')}
                value={csv(getPath(stream, 'tlsSettings.alpn'))}
                onChange={(v) => set('streamSettings.tlsSettings.alpn')(fromCsv(v))}
              />
            </>
          )}
          {security === 'reality' && (
            <>
              <Field
                label={t('pages.inbounds.targetAddress')}
                value={str(getPath(stream, 'realitySettings.target'))}
                onChange={set('streamSettings.realitySettings.target')}
              />
              <Field
                label={t('pages.hosts.fields.sni')}
                value={csv(getPath(stream, 'realitySettings.serverNames'))}
                onChange={(v) => set('streamSettings.realitySettings.serverNames')(fromCsv(v))}
              />
              <Field
                label={t('pages.inbounds.form.shortIds')}
                value={csv(getPath(stream, 'realitySettings.shortIds'))}
                onChange={(v) => set('streamSettings.realitySettings.shortIds')(fromCsv(v))}
              />
              <Field
                label={t('pages.inbounds.privatekey')}
                value={str(getPath(stream, 'realitySettings.privateKey'))}
                onChange={set('streamSettings.realitySettings.privateKey')}
              />
              <Field
                label={t('pages.inbounds.publicKey')}
                value={str(getPath(stream, 'realitySettings.settings.publicKey'))}
                onChange={set('streamSettings.realitySettings.settings.publicKey')}
              />
              <Button title={t('pages.inbounds.vlessAuthGenerateButton')} busy={keys.isPending} onPress={() => void applyReality()} />
            </>
          )}
        </Card>
      )}

      <Card>
        <SwitchRow
          label={t('pages.inbounds.sniffingTab')}
          value={!!getPath(draft.sniffing, 'enabled')}
          onChange={set('sniffing.enabled')}
          onText={t('enabled')}
          offText={t('disabled')}
        />
      </Card>

      <Card>
        <Title>{t('pages.inbounds.advanced.title')}</Title>
        <Muted>{t('pages.inbounds.advanced.subtitle')}</Muted>
        <JsonSection title={t('pages.inbounds.advanced.settings')} value={draft.settings} onApply={set('settings')} />
        {streamed && (
          <JsonSection title={t('pages.inbounds.advanced.stream')} value={draft.streamSettings} onApply={set('streamSettings')} />
        )}
        <JsonSection title={t('pages.inbounds.advanced.sniffing')} value={draft.sniffing} onApply={set('sniffing')} />
      </Card>

      {save.error && <ErrorCard error={save.error} />}
      <Button
        title={original ? t('save') : t('create')}
        kind="primary"
        busy={save.isPending}
        onPress={() => save.mutate()}
      />
    </Screen>
  );
}

function EditInboundScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const api = useApi();
  const t = useT();
  const inboundId = id ? Number(id) : 0;
  const inbound = useQuery({ queryKey: ['inbound', inboundId], queryFn: () => api.inbound(inboundId), enabled: inboundId > 0 });
  const title = inboundId ? t('pages.inbounds.modifyInbound') : t('pages.inbounds.addInbound');
  if (inboundId && inbound.isLoading) return <Loading />;
  if (inboundId && !inbound.data) return <Screen>{inbound.error && <ErrorCard error={inbound.error} />}</Screen>;
  return (
    <>
      <Stack.Screen options={{ title }} />
      <InboundForm original={inbound.data} />
    </>
  );
}

export default function EditInboundRoute() {
  return (
    <RequireSession>
      <EditInboundScreen />
    </RequireSession>
  );
}
