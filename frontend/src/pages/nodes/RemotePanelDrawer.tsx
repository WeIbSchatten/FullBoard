import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  BranchesOutlined,
  ExportOutlined,
  LoginOutlined,
  PoweroffOutlined,
  ReloadOutlined,
  RetweetOutlined,
  SaveOutlined,
} from '@ant-design/icons';

import type { NodeRecord } from '@/api/queries/useNodesQuery';
import type { RemoteLoginURL } from '@/generated/types';
import { HttpUtil, SizeFormatter } from '@/utils';
import RemoteBackupTab from './RemoteBackupTab';
import RemoteLiveInbounds from './RemoteLiveInbounds';
import RemoteLogsTab from './RemoteLogsTab';
import RemoteXrayTab from './RemoteXrayTab';

interface RemoteStatus {
  cpu?: number;
  cpuCores?: number;
  mem?: { current?: number; total?: number };
  disk?: { current?: number; total?: number };
  uptime?: number;
  xray?: { state?: string; errorMsg?: string; version?: string };
  appStats?: { threads?: number; mem?: number; uptime?: number };
}

interface ClientStat {
  email: string;
  up?: number;
  down?: number;
  total?: number;
  enable?: boolean;
}

interface MasterInbound {
  id: number;
  remark?: string;
  tag?: string;
  protocol?: string;
  port?: number;
  up?: number;
  down?: number;
  total?: number;
  enable?: boolean;
  nodeId?: number;
  clientStats?: ClientStat[] | null;
}

type RemoteSettings = Record<string, unknown>;

const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } };

const CURATED_SETTINGS: { key: string; kind: 'number' | 'text' | 'bool' | 'css' }[] = [
  { key: 'pageSize', kind: 'number' },
  { key: 'timeLocation', kind: 'text' },
  { key: 'subEnable', kind: 'bool' },
  { key: 'subPort', kind: 'number' },
  { key: 'subPath', kind: 'text' },
  { key: 'tgBotEnable', kind: 'bool' },
  { key: 'restartXrayOnClientDisable', kind: 'bool' },
  { key: 'customCssBundle', kind: 'text' },
  { key: 'navPosition', kind: 'text' },
];

export function inboundsOfNode(inbounds: MasterInbound[], nodeId: number): MasterInbound[] {
  return inbounds.filter((ib) => ib.nodeId === nodeId);
}

function pct(current?: number, total?: number): number {
  if (!current || !total) return 0;
  return Math.min(100, Math.round((current / total) * 100));
}

interface RemotePanelDrawerProps {
  node: NodeRecord | null;
  onClose: () => void;
}

export default function RemotePanelDrawer({ node, onClose }: RemotePanelDrawerProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [modal, modalContextHolder] = Modal.useModal();
  const [messageApi, messageContextHolder] = message.useMessage();
  const nodeId = node?.id ?? 0;
  const queryClient = useQueryClient();

  const [settings, setSettings] = useState<RemoteSettings | null>(null);
  const [settingsError, setSettingsError] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsJson, setSettingsJson] = useState('');
  const [jsonMode, setJsonMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ['nodes', 'remote', nodeId, 'status'],
    enabled: nodeId > 0,
    queryFn: async () => {
      const msg = await HttpUtil.get<RemoteStatus>(
        `/panel/api/nodes/remote/${nodeId}/status`,
        undefined,
        { silent: true },
      );
      if (!msg?.success) throw new Error(msg?.msg || t('somethingWentWrong'));
      return msg.obj ?? null;
    },
  });
  const status = statusQuery.data ?? null;
  const statusError = statusQuery.error?.message ?? '';
  const statusLoading = statusQuery.isFetching;
  const { refetch: refetchStatus } = statusQuery;
  const loadStatus = useCallback(() => void refetchStatus(), [refetchStatus]);

  const inboundsQuery = useQuery({
    queryKey: ['nodes', 'remote', nodeId, 'inbounds'],
    enabled: nodeId > 0,
    queryFn: async () => {
      const msg = await HttpUtil.get<MasterInbound[]>('/panel/api/inbounds/list', undefined, {
        silent: true,
      });
      return msg?.success && Array.isArray(msg.obj) ? inboundsOfNode(msg.obj, nodeId) : [];
    },
  });
  const inbounds = useMemo(() => inboundsQuery.data ?? [], [inboundsQuery.data]);
  const inboundsLoading = inboundsQuery.isFetching;
  const { refetch: refetchInbounds } = inboundsQuery;
  const loadInbounds = useCallback(async () => {
    await refetchInbounds();
  }, [refetchInbounds]);

  const loadSettings = useCallback(async () => {
    if (!nodeId) return;
    setSettingsLoading(true);
    const msg = await HttpUtil.get<RemoteSettings>(
      `/panel/api/nodes/remote/${nodeId}/settings`,
      undefined,
      { silent: true },
    );
    setSettingsLoading(false);
    if (msg?.success && msg.obj) {
      setSettings(msg.obj);
      setSettingsJson(JSON.stringify(msg.obj, null, 2));
      setSettingsError('');
    } else {
      setSettings(null);
      setSettingsError(msg?.msg || t('somethingWentWrong'));
    }
  }, [nodeId, t]);

  const runAction = useCallback(async (key: string, url: string, after?: () => void) => {
    setBusy(key);
    try {
      const msg = await HttpUtil.post(url);
      if (msg?.success) after?.();
    } finally {
      setBusy(null);
    }
  }, []);

  const loginAs = useCallback(async () => {
    // Opened synchronously so the popup blocker treats it as a user gesture.
    const win = window.open('about:blank', '_blank');
    if (win) win.opener = null;
    setBusy('loginAs');
    try {
      const msg = await HttpUtil.post<RemoteLoginURL>(`/panel/api/nodes/remote/${nodeId}/loginAs`);
      if (msg?.success && msg.obj?.url) {
        if (win) win.location.href = msg.obj.url;
        else window.location.assign(msg.obj.url);
      } else {
        win?.close();
      }
    } catch {
      win?.close();
    } finally {
      setBusy(null);
    }
  }, [nodeId]);

  const refreshAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['nodes', 'remote', nodeId] });
  }, [queryClient, nodeId]);

  const confirmRestartPanel = useCallback(() => {
    modal.confirm({
      title: t('pages.nodes.remote.restartPanelConfirm', { name: node?.name ?? '' }),
      content: t('pages.nodes.remote.restartPanelDesc'),
      okButtonProps: { danger: true },
      okText: t('pages.nodes.remote.restartPanel'),
      cancelText: t('cancel'),
      onOk: () => runAction('panel', `/panel/api/nodes/remote/${nodeId}/restartPanel`),
    });
  }, [modal, t, node?.name, nodeId, runAction]);

  const saveSettings = useCallback(async () => {
    let payload: RemoteSettings | null = settings;
    if (jsonMode) {
      try {
        const parsed: unknown = JSON.parse(settingsJson);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
        payload = parsed as RemoteSettings;
      } catch {
        messageApi.error(t('pages.xray.importInvalidJson'));
        return;
      }
    }
    if (!payload) return;
    setSaving(true);
    try {
      const msg = await HttpUtil.post(
        `/panel/api/nodes/remote/${nodeId}/settings`,
        payload,
        JSON_HEADERS,
      );
      if (msg?.success) await loadSettings();
    } finally {
      setSaving(false);
    }
  }, [settings, jsonMode, settingsJson, nodeId, messageApi, t, loadSettings]);

  const updateField = (key: string, value: unknown) =>
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));

  const clients = useMemo(
    () =>
      inbounds.flatMap((ib) =>
        (ib.clientStats ?? []).map((c) => ({ ...c, inbound: ib.remark || ib.tag || `#${ib.id}` })),
      ),
    [inbounds],
  );

  const inboundColumns: ColumnsType<MasterInbound> = [
    {
      title: t('pages.inbounds.remark'),
      render: (_v, ib) => ib.remark || ib.tag || `#${ib.id}`,
    },
    {
      title: t('pages.inbounds.protocol'),
      render: (_v, ib) => (
        <Tag>
          {ib.protocol}:{ib.port}
        </Tag>
      ),
    },
    {
      title: t('pages.inbounds.traffic'),
      render: (_v, ib) =>
        `${SizeFormatter.sizeFormat((ib.up ?? 0) + (ib.down ?? 0))}${
          ib.total ? ` / ${SizeFormatter.sizeFormat(ib.total)}` : ''
        }`,
    },
    {
      title: t('pages.nodes.remote.clients'),
      align: 'center',
      render: (_v, ib) => ib.clientStats?.length ?? 0,
    },
    {
      title: t('enable'),
      align: 'center',
      render: (_v, ib) => (
        <Switch
          size="small"
          checked={!!ib.enable}
          loading={busy === `enable-${ib.id}`}
          onChange={async (enable) => {
            setBusy(`enable-${ib.id}`);
            try {
              const msg = await HttpUtil.post(`/panel/api/inbounds/setEnable/${ib.id}`, { enable });
              if (msg?.success) await loadInbounds();
            } finally {
              setBusy(null);
            }
          }}
        />
      ),
    },
    {
      title: t('pages.nodes.actions'),
      render: (_v, ib) => (
        <Space size="small">
          <Popconfirm
            title={t('pages.inbounds.resetTrafficContent')}
            okText={t('reset')}
            cancelText={t('cancel')}
            onConfirm={() =>
              runAction(`reset-${ib.id}`, `/panel/api/inbounds/${ib.id}/resetTraffic`, loadInbounds)
            }
          >
            <Button
              size="small"
              icon={<RetweetOutlined />}
              loading={busy === `reset-${ib.id}`}
              aria-label={t('pages.inbounds.resetTraffic')}
            />
          </Popconfirm>
          <Button
            size="small"
            icon={<BranchesOutlined />}
            onClick={() => navigate(`/outbound?chainNode=${nodeId}&chainInbound=${ib.id}`)}
          >
            {t('pages.nodes.remote.routeVia')}
          </Button>
        </Space>
      ),
    },
  ];

  const clientColumns: ColumnsType<ClientStat & { inbound: string }> = [
    { title: t('pages.inbounds.email'), dataIndex: 'email' },
    { title: t('pages.nodes.remote.inbound'), dataIndex: 'inbound' },
    {
      title: t('pages.inbounds.traffic'),
      render: (_v, c) =>
        `${SizeFormatter.sizeFormat((c.up ?? 0) + (c.down ?? 0))}${
          c.total ? ` / ${SizeFormatter.sizeFormat(c.total)}` : ''
        }`,
    },
    {
      title: t('enable'),
      align: 'center',
      render: (_v, c) =>
        c.enable === false ? (
          <Tag color="red">{t('disabled')}</Tag>
        ) : (
          <Tag color="green">{t('enabled')}</Tag>
        ),
    },
    {
      title: t('pages.nodes.actions'),
      render: (_v, c) => (
        <Popconfirm
          title={t('pages.inbounds.resetTrafficContent')}
          okText={t('reset')}
          cancelText={t('cancel')}
          onConfirm={() =>
            runAction(
              `client-${c.email}`,
              `/panel/api/clients/resetTraffic/${encodeURIComponent(c.email)}`,
              loadInbounds,
            )
          }
        >
          <Button
            size="small"
            icon={<RetweetOutlined />}
            loading={busy === `client-${c.email}`}
            aria-label={t('pages.inbounds.resetTraffic')}
          />
        </Popconfirm>
      ),
    },
  ];

  const xrayState = status?.xray?.state ?? '';
  const overview = (
    <Spin spinning={statusLoading}>
      <Space orientation="vertical" style={{ width: '100%' }} size="middle">
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={loadStatus}>
            {t('refresh')}
          </Button>
          <Button
            icon={<RetweetOutlined />}
            loading={busy === 'xray'}
            onClick={() =>
              runAction('xray', `/panel/api/nodes/remote/${nodeId}/restartXray`, loadStatus)
            }
          >
            {t('pages.nodes.remote.restartXray')}
          </Button>
          <Button
            danger
            icon={<PoweroffOutlined />}
            loading={busy === 'panel'}
            onClick={confirmRestartPanel}
          >
            {t('pages.nodes.remote.restartPanel')}
          </Button>
          <Button
            type="primary"
            icon={<LoginOutlined />}
            loading={busy === 'loginAs'}
            onClick={() => void loginAs()}
          >
            {t('pages.nodes.remote.loginAs')}
          </Button>
          {node && (
            <Button
              icon={<ExportOutlined />}
              href={`${node.scheme}://${node.address}:${node.port}${node.basePath || '/'}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('pages.nodes.remote.openPanel')}
            </Button>
          )}
        </Space>
        {statusError && <Alert type="error" showIcon title={statusError} />}
        {status && (
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="CPU">
              <Progress percent={Math.round(status.cpu ?? 0)} size="small" />
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.nodes.remote.memory')}>
              <Progress percent={pct(status.mem?.current, status.mem?.total)} size="small" />
              {SizeFormatter.sizeFormat(status.mem?.current)} /{' '}
              {SizeFormatter.sizeFormat(status.mem?.total)}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.nodes.remote.disk')}>
              <Progress percent={pct(status.disk?.current, status.disk?.total)} size="small" />
            </Descriptions.Item>
            <Descriptions.Item label="Xray">
              <Tag color={xrayState === 'running' ? 'green' : 'red'}>{xrayState || '-'}</Tag>
              {status.xray?.version}
              {status.xray?.errorMsg && (
                <Typography.Paragraph type="danger" style={{ margin: 0 }}>
                  {status.xray.errorMsg}
                </Typography.Paragraph>
              )}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Space>
    </Spin>
  );

  const inboundsTab = (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
        {t('pages.nodes.remote.inboundsHint')}
      </Typography.Paragraph>
      <Space wrap>
        <Button icon={<ReloadOutlined />} onClick={loadInbounds}>
          {t('refresh')}
        </Button>
        <Button onClick={() => navigate('/inbounds')}>
          {t('pages.nodes.remote.openInbounds')}
        </Button>
        <Button
          icon={<BranchesOutlined />}
          onClick={() => navigate(`/outbound?chainNode=${nodeId}`)}
        >
          {t('pages.nodes.remote.routeVia')}
        </Button>
      </Space>
      <Table<MasterInbound>
        rowKey="id"
        size="small"
        loading={inboundsLoading}
        dataSource={inbounds}
        columns={inboundColumns}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <Empty description={t('noData')} /> }}
      />
      <RemoteLiveInbounds nodeId={nodeId} />
      <Typography.Title level={5}>{t('pages.nodes.remote.clients')}</Typography.Title>
      <Table
        rowKey={(c) => `${c.inbound}-${c.email}`}
        size="small"
        loading={inboundsLoading}
        dataSource={clients}
        columns={clientColumns}
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        scroll={{ x: 'max-content' }}
      />
    </Space>
  );

  const settingsTab = (
    <Spin spinning={settingsLoading}>
      <Space orientation="vertical" style={{ width: '100%' }}>
        <Alert type="info" showIcon title={t('pages.nodes.remote.settingsHint')} />
        {settingsError && <Alert type="error" showIcon title={settingsError} />}
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={loadSettings}>
            {settings ? t('refresh') : t('pages.nodes.remote.loadSettings')}
          </Button>
          {settings && (
            <>
              <Switch
                checked={jsonMode}
                onChange={(v) => {
                  if (v) setSettingsJson(JSON.stringify(settings, null, 2));
                  setJsonMode(v);
                }}
              />
              <span>{t('pages.nodes.remote.jsonMode')}</span>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                onClick={saveSettings}
              >
                {t('save')}
              </Button>
            </>
          )}
        </Space>
        {settings && jsonMode && (
          <Input.TextArea
            rows={20}
            spellCheck={false}
            style={{ fontFamily: 'monospace' }}
            value={settingsJson}
            onChange={(e) => setSettingsJson(e.target.value)}
          />
        )}
        {settings && !jsonMode && (
          <Descriptions bordered size="small" column={1}>
            {CURATED_SETTINGS.filter((f) => f.key in settings).map((f) => (
              <Descriptions.Item key={f.key} label={f.key}>
                {f.kind === 'bool' && (
                  <Switch checked={!!settings[f.key]} onChange={(v) => updateField(f.key, v)} />
                )}
                {f.kind === 'number' && (
                  <InputNumber
                    value={Number(settings[f.key] ?? 0)}
                    onChange={(v) => updateField(f.key, v ?? 0)}
                  />
                )}
                {f.kind === 'text' && (
                  <Input
                    value={String(settings[f.key] ?? '')}
                    onChange={(e) => updateField(f.key, e.target.value)}
                  />
                )}
                {f.kind === 'css' && (
                  <Input.TextArea
                    rows={4}
                    spellCheck={false}
                    style={{ fontFamily: 'monospace' }}
                    value={String(settings[f.key] ?? '')}
                    onChange={(e) => updateField(f.key, e.target.value)}
                  />
                )}
              </Descriptions.Item>
            ))}
          </Descriptions>
        )}
      </Space>
    </Spin>
  );

  return (
    <Drawer
      open={!!node}
      onClose={onClose}
      size="large"
      destroyOnHidden
      title={node ? t('pages.nodes.remote.title', { name: node.name }) : ''}
    >
      {modalContextHolder}
      {messageContextHolder}
      <Tabs
        items={[
          { key: 'overview', label: t('pages.nodes.remote.overview'), children: overview },
          { key: 'inbounds', label: t('pages.nodes.remote.inboundsTab'), children: inboundsTab },
          {
            key: 'settings',
            label: t('pages.nodes.remote.settings'),
            children: settingsTab,
          },
          {
            key: 'logs',
            label: t('pages.index.logs'),
            children: <RemoteLogsTab nodeId={nodeId} />,
          },
          {
            key: 'xray',
            label: 'Xray',
            children: <RemoteXrayTab nodeId={nodeId} onChanged={loadStatus} />,
          },
          {
            key: 'backup',
            label: t('pages.index.backupTitle'),
            children: <RemoteBackupTab nodeId={nodeId} onChanged={refreshAll} />,
          },
        ]}
      />
    </Drawer>
  );
}
