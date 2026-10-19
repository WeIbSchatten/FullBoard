import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Pressable, View } from 'react-native';

import { Chips } from '@/components/Pickers';
import { Field } from '@/components/form';
import { Badge, Body, Button, Card, ErrorCard, Muted, Row, Title } from '@/components/ui';
import { formatBytes } from '@/lib/format';
import {
  describeOutbound,
  describeRule,
  getSection,
  listOf,
  moveItem,
  setSection,
  type XrayConfig,
} from '@/lib/xrayConfig';
import { useT } from '@/i18n';
import { useApi } from '@/session';
import { xrayDraft } from '@/xrayDraft';

import { XrayLoadState, XraySaveBar, useOpenItem, useXrayTemplate } from './XrayShared';

type Obj = Record<string, unknown>;

function MoveButtons({ path, index, count }: { path: string; index: number; count: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      <Button title="↑" disabled={index === 0} onPress={() => xrayDraft.update((c) => moveItem(c, path, index, -1))} />
      <Button title="↓" disabled={index === count - 1} onPress={() => xrayDraft.update((c) => moveItem(c, path, index, 1))} />
    </View>
  );
}

export function OutboundsSection() {
  const api = useApi();
  const t = useT();
  const open = useOpenItem();
  const { draft } = useXrayTemplate();
  const traffic = useQuery({ queryKey: ['outboundsTraffic'], queryFn: api.outboundsTraffic });
  const [results, setResults] = useState<Record<string, string>>({});
  const test = useMutation({
    mutationFn: async ({ outbound, all }: { outbound: Obj; all: unknown[] }) => api.testOutbound(outbound, all),
    onSuccess: (r, v) =>
      setResults((m) => ({ ...m, [String(v.outbound.tag)]: r.success ? `${r.delay} ms` : r.error || t('fail') })),
    onError: (e, v) => setResults((m) => ({ ...m, [String(v.outbound.tag)]: e instanceof Error ? e.message : String(e) })),
  });
  const cfg = draft.cfg;
  const outbounds = cfg ? listOf(cfg, 'outbounds') : [];
  return (
    <>
      <XrayLoadState />
      <XraySaveBar />
      <Button
        title={`${t('add')} · ${t('pages.xray.Outbounds')}`}
        kind="primary"
        onPress={() => open('outbounds', -1)}
      />
      {outbounds.map((o, i) => {
        const ob = o as Obj;
        const tag = String(ob.tag ?? '');
        const tr = traffic.data?.find((x) => x.tag === tag);
        return (
          <Card key={`${tag}-${i}`}>
            <Pressable onPress={() => open('outbounds', i)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Body>{tag || '—'}</Body>
                {i === 0 && <Badge text={t('pages.xray.defaultOutbound')} tone="success" />}
              </View>
              <Muted>{describeOutbound(ob)}</Muted>
              {tr && (
                <Muted>
                  ↑ {formatBytes(tr.up)} ↓ {formatBytes(tr.down)}
                </Muted>
              )}
              {!!results[tag] && <Muted>{results[tag]}</Muted>}
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <MoveButtons path="outbounds" index={i} count={outbounds.length} />
              <View style={{ flex: 1 }}>
                <Button
                  title={t('check')}
                  busy={test.isPending && test.variables?.outbound === ob}
                  onPress={() => test.mutate({ outbound: ob, all: outbounds })}
                />
              </View>
            </View>
          </Card>
        );
      })}
    </>
  );
}

const DOMAIN_STRATEGIES = ['AsIs', 'IPIfNonMatch', 'IPOnDemand'];

function RouteTester() {
  const api = useApi();
  const t = useT();
  const [domain, setDomain] = useState('');
  const [port, setPort] = useState('');
  const run = useMutation({
    mutationFn: () =>
      api.routeTest(/^[\d.:a-fA-F]+$/.test(domain) ? { ip: domain, port } : { domain, port }),
  });
  return (
    <Card>
      <Title>{t('pages.xray.routeTester')}</Title>
      <Muted>{t('pages.xray.routeTesterDesc')}</Muted>
      <Field label={t('pages.xray.routeTesterDest')} value={domain} onChange={setDomain} placeholder="example.com / 1.1.1.1" />
      <Field label={t('pages.xray.routeTesterPort')} value={port} onChange={setPort} keyboard="number-pad" />
      <Button title={t('pages.xray.routeTesterTest')} disabled={!domain.trim()} busy={run.isPending} onPress={() => run.mutate()} />
      {run.error && <ErrorCard error={run.error} />}
      {run.data && (
        <Row
          label={run.data.matched ? t('pages.xray.routeTesterMatchedOutbound') : t('pages.xray.routeTesterDefaultOutbound')}
          value={[run.data.outboundTag, ...(run.data.groupTags ?? []).map((g) => `⚖ ${g}`)].filter(Boolean).join(' · ') || '—'}
        />
      )}
    </Card>
  );
}

export function RoutingSection() {
  const t = useT();
  const open = useOpenItem();
  const { draft } = useXrayTemplate();
  const cfg = draft.cfg;
  const rules = cfg ? listOf(cfg, 'routing.rules') : [];
  const strategy = cfg ? String(getSection(cfg, 'routing.domainStrategy') ?? 'AsIs') : 'AsIs';
  return (
    <>
      <XrayLoadState />
      <XraySaveBar />
      <Card>
        <Title>{t('pages.xray.RoutingStrategy')}</Title>
        <Chips
          options={DOMAIN_STRATEGIES.map((s) => ({ value: s, label: s }))}
          value={strategy}
          onChange={(s) => xrayDraft.update((c: XrayConfig) => setSection(c, 'routing.domainStrategy', s))}
        />
      </Card>
      <RouteTester />
      <Button title={`${t('add')} · ${t('pages.xray.Routings')}`} kind="primary" onPress={() => open('routing.rules', -1)} />
      {rules.map((r, i) => {
        const d = describeRule(r);
        return (
          <Card key={i}>
            <Pressable onPress={() => open('routing.rules', i)}>
              <Body>
                {i + 1}. → {d.target}
              </Body>
              <Muted numberOfLines={3}>{d.match || '—'}</Muted>
            </Pressable>
            <MoveButtons path="routing.rules" index={i} count={rules.length} />
          </Card>
        );
      })}
    </>
  );
}

export function BalancersSection() {
  const t = useT();
  const open = useOpenItem();
  const { draft } = useXrayTemplate();
  const balancers = draft.cfg ? listOf(draft.cfg, 'routing.balancers') : [];
  return (
    <>
      <XrayLoadState />
      <XraySaveBar />
      <Button title={`${t('add')} · ${t('pages.xray.Balancers')}`} kind="primary" onPress={() => open('routing.balancers', -1)} />
      {!balancers.length && <Muted>{t('emptyBalancersDesc')}</Muted>}
      {balancers.map((b, i) => {
        const bal = b as Obj;
        const strategy = ((bal.strategy as Obj | undefined)?.type as string | undefined) ?? 'random';
        return (
          <Pressable key={i} onPress={() => open('routing.balancers', i)}>
            <Card>
              <Body>{String(bal.tag ?? '—')}</Body>
              <Muted>
                {strategy} · {Array.isArray(bal.selector) ? (bal.selector as string[]).join(', ') : ''}
              </Muted>
            </Card>
          </Pressable>
        );
      })}
    </>
  );
}

export function DnsSection() {
  const t = useT();
  const open = useOpenItem();
  const { draft } = useXrayTemplate();
  const cfg = draft.cfg;
  const dns = cfg ? (getSection(cfg, 'dns') as Obj | undefined) : undefined;
  const servers = cfg ? listOf(cfg, 'dns.servers') : [];
  return (
    <>
      <XrayLoadState />
      <XraySaveBar />
      <Card>
        <Title>DNS</Title>
        {!dns && <Muted>{t('emptyDnsDesc')}</Muted>}
        {servers.map((s, i) => (
          <Pressable key={i} onPress={() => open('dns.servers', i)}>
            <Body>{typeof s === 'string' ? s : String((s as Obj).address ?? JSON.stringify(s))}</Body>
          </Pressable>
        ))}
        <Button title={t('pages.xray.dns.add')} onPress={() => open('dns.servers', -1)} />
        <Button title={`DNS · JSON`} onPress={() => open('dns', -2)} />
      </Card>
      <Card>
        <Title>Fake DNS</Title>
        <Button title={`Fake DNS · JSON`} onPress={() => open('fakedns', -2)} />
      </Card>
      <Card>
        <Title>{t('pages.xray.completeTemplate')}</Title>
        <Button title={`Xray · JSON`} onPress={() => open('', -2)} />
      </Card>
    </>
  );
}
