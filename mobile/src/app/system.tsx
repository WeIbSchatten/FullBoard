import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { Alert, View } from 'react-native';

import { Chips } from '@/components/Pickers';
import { SwitchRow } from '@/components/form';
import { Badge, Button, Card, ErrorCard, Muted, Row, Screen, Title } from '@/components/ui';
import { useT } from '@/i18n';
import { shareDatabaseBackup } from '@/lib/backup';
import { RequireSession, useApi, useSession } from '@/session';

const GEOFILES = ['geosite.dat', 'geoip.dat', 'geosite_IR.dat', 'geoip_IR.dat', 'geosite_RU.dat', 'geoip_RU.dat'];

function confirm(title: string, body: string, ok: string, cancel: string, run: () => void) {
  Alert.alert(title, body, [
    { text: cancel, style: 'cancel' },
    { text: ok, onPress: run },
  ]);
}

function XrayCard() {
  const api = useApi();
  const t = useT();
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ['status'], queryFn: api.status });
  const versions = useQuery({ queryKey: ['xrayVersions'], queryFn: api.xrayVersions });
  const [version, setVersion] = useState('');
  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSettled: () => qc.invalidateQueries({ queryKey: ['status'] }),
  });
  const xray = status.data?.xray;
  return (
    <Card>
      <Title>Xray</Title>
      {xray && (
        <Row
          label={xray.version}
          value={<Badge text={xray.state} tone={xray.state === 'running' ? 'success' : 'error'} />}
        />
      )}
      {!!xray?.errorMsg && <Muted>{xray.errorMsg}</Muted>}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button title={t('pages.index.restartXray')} busy={act.isPending} onPress={() => act.mutate(api.restartXray)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={t('pages.index.stopXray')} kind="danger" busy={act.isPending} onPress={() => act.mutate(api.stopXray)} />
        </View>
      </View>
      <Title>{t('pages.index.xraySwitch')}</Title>
      <Muted>{t('pages.index.xraySwitchClickDesk')}</Muted>
      {versions.error && <ErrorCard error={versions.error} />}
      <Chips options={(versions.data ?? []).map((v) => ({ value: v, label: v }))} value={version} onChange={setVersion} />
      <Button
        title={version ? `${t('install')} ${version}` : t('install')}
        kind="primary"
        disabled={!version}
        busy={act.isPending}
        onPress={() =>
          confirm(
            t('pages.index.xraySwitchVersionDialog'),
            t('pages.index.xraySwitchVersionDialogDesc').replace('#version#', version),
            t('confirm'),
            t('cancel'),
            () => act.mutate(() => api.installXray(version)),
          )
        }
      />
      <Title>{t('pages.index.geofilesUpdateAll')}</Title>
      {GEOFILES.map((f) => (
        <Row
          key={f}
          label={f}
          value={
            <Button
              title={t('update')}
              onPress={() =>
                confirm(
                  t('pages.index.geofileUpdateDialog'),
                  t('pages.index.geofileUpdateDialogDesc').replace('#filename#', f),
                  t('confirm'),
                  t('cancel'),
                  () => act.mutate(() => api.updateGeofile(f)),
                )
              }
            />
          }
        />
      ))}
      <Button
        title={t('pages.index.geofilesUpdateAll')}
        busy={act.isPending}
        onPress={() =>
          confirm(t('pages.index.geofileUpdateDialog'), t('pages.index.geofilesUpdateDialogDesc'), t('confirm'), t('cancel'), () =>
            act.mutate(() => api.updateGeofile('')),
          )
        }
      />
      {act.error && <ErrorCard error={act.error} />}
      {act.isSuccess && typeof act.data === 'string' && !!act.data && <Muted>✓ {act.data}</Muted>}
    </Card>
  );
}

function PanelUpdateCard() {
  const api = useApi();
  const t = useT();
  const qc = useQueryClient();
  const info = useQuery({ queryKey: ['panelUpdate'], queryFn: api.panelUpdateInfo });
  const refresh = () => qc.invalidateQueries({ queryKey: ['panelUpdate'] });
  const channel = useMutation({ mutationFn: api.setUpdateChannel, onSettled: refresh });
  const update = useMutation({ mutationFn: api.updatePanel });
  const i = info.data;
  const dev = i?.channel === 'dev';
  return (
    <Card>
      <Title>{t('pages.index.updatePanel')}</Title>
      <Muted>{t('pages.index.panelUpdateDesc')}</Muted>
      {info.error && <ErrorCard error={info.error} onRetry={() => void info.refetch()} />}
      {i && (
        <>
          <SwitchRow label={t('pages.index.devChannel')} value={dev} onChange={(v) => channel.mutate(v)} disabled={channel.isPending} />
          {dev && <Muted>{t('pages.index.devChannelWarning')}</Muted>}
          <Row
            label={dev ? t('pages.index.currentCommit') : t('pages.index.currentPanelVersion')}
            value={(dev ? i.currentCommit : i.currentVersion) || '—'}
          />
          <Row
            label={dev ? t('pages.index.latestCommit') : t('pages.index.latestPanelVersion')}
            value={(dev ? i.latestCommit : i.latestVersion) || '—'}
          />
          {!i.updateAvailable && <Badge text={t('pages.index.panelUpToDate')} tone="success" />}
        </>
      )}
      {(channel.error || update.error) && <ErrorCard error={channel.error ?? update.error} />}
      {update.isSuccess && <Muted>{t('pages.index.dontRefresh')}</Muted>}
      <Button
        title={t('pages.index.updatePanel')}
        kind="primary"
        disabled={!i?.updateAvailable}
        busy={update.isPending}
        onPress={() =>
          confirm(
            t('pages.index.panelUpdateDialog'),
            t('pages.index.panelUpdateDialogDesc').replace('#version#', (dev ? i?.latestCommit : i?.latestVersion) ?? ''),
            t('confirm'),
            t('cancel'),
            () => update.mutate(),
          )
        }
      />
    </Card>
  );
}

function BackupCard() {
  const t = useT();
  const { session } = useSession();
  const backup = useMutation({ mutationFn: () => shareDatabaseBackup(session!) });
  return (
    <Card>
      <Title>{t('pages.index.backupTitle')}</Title>
      <Muted>{t('pages.index.exportDatabaseDesc')}</Muted>
      {backup.error && <ErrorCard error={backup.error} />}
      <Button title={t('pages.index.exportDatabase')} kind="primary" busy={backup.isPending} onPress={() => backup.mutate()} />
    </Card>
  );
}

function SystemScreen() {
  const t = useT();
  return (
    <Screen>
      <Stack.Screen options={{ title: t('pages.index.xrayUpdates') }} />
      <XrayCard />
      <PanelUpdateCard />
      <BackupCard />
    </Screen>
  );
}

export default function SystemRoute() {
  return (
    <RequireSession>
      <SystemScreen />
    </RequireSession>
  );
}
