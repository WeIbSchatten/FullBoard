import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AutoComplete, Button, Input, Modal, Space, Spin, Typography } from 'antd';
import {
  DownloadOutlined,
  PoweroffOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons';

import { HttpUtil } from '@/utils';

const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } };

const GEOFILES = [
  'geosite.dat',
  'geoip.dat',
  'geosite_IR.dat',
  'geoip_IR.dat',
  'geosite_RU.dat',
  'geoip_RU.dat',
];

interface RemoteXrayResponse {
  xraySetting?: unknown;
  outboundTestUrl?: string;
}

// The node wraps its payload as a JSON string or an object depending on version.
function unwrapXrayResponse(obj: unknown): RemoteXrayResponse | null {
  if (typeof obj === 'string') {
    try {
      return JSON.parse(obj) as RemoteXrayResponse;
    } catch {
      return null;
    }
  }
  return obj && typeof obj === 'object' ? (obj as RemoteXrayResponse) : null;
}

interface RemoteXrayTabProps {
  nodeId: number;
  onChanged: () => void;
}

export default function RemoteXrayTab({ nodeId, onChanged }: RemoteXrayTabProps) {
  const { t } = useTranslation();
  const [modal, modalContextHolder] = Modal.useModal();
  const [template, setTemplate] = useState('');
  const [outboundTestUrl, setOutboundTestUrl] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [version, setVersion] = useState('');
  const [versions, setVersions] = useState<string[]>([]);

  const base = `/panel/api/nodes/remote/${nodeId}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const msg = await HttpUtil.get(`${base}/xray`, undefined, { silent: true });
      const data = msg?.success ? unwrapXrayResponse(msg.obj) : null;
      if (!data) {
        setError(msg?.msg || t('somethingWentWrong'));
        return;
      }
      const raw = data.xraySetting;
      setTemplate(typeof raw === 'string' ? raw : JSON.stringify(raw ?? {}, null, 2));
      setOutboundTestUrl(data.outboundTestUrl ?? '');
      setError('');
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [base, t]);

  useEffect(() => {
    void (async () => {
      const msg = await HttpUtil.get<string[]>('/panel/api/server/getXrayVersion', undefined, {
        silent: true,
      });
      if (msg?.success && Array.isArray(msg.obj)) setVersions(msg.obj);
    })();
  }, []);

  const run = useCallback(async (key: string, url: string, body?: unknown, after?: () => void) => {
    setBusy(key);
    try {
      const msg = await HttpUtil.post(url, body, JSON_HEADERS);
      if (msg?.success) after?.();
    } finally {
      setBusy(null);
    }
  }, []);

  const save = () => {
    let pretty = template;
    try {
      pretty = JSON.stringify(JSON.parse(template) as unknown);
    } catch {
      Modal.error({ title: t('pages.xray.importInvalidJson') });
      return;
    }
    void run('save', `${base}/xray`, { xraySetting: pretty, outboundTestUrl }, () => {
      void load();
      onChanged();
    });
  };

  const confirmStop = () =>
    modal.confirm({
      title: t('pages.nodes.remote.stopXrayConfirm'),
      okButtonProps: { danger: true },
      okText: t('pages.index.stopXray'),
      cancelText: t('cancel'),
      onOk: () => run('stop', `${base}/stopXray`, undefined, onChanged),
    });

  const confirmInstall = () => {
    const wanted = version.trim();
    if (!wanted) return;
    modal.confirm({
      title: t('pages.index.xraySwitchVersionDialog'),
      content: t('pages.index.xraySwitchVersionDialogDesc').replace('#version#', wanted),
      okText: t('confirm'),
      cancelText: t('cancel'),
      onOk: () => run('install', `${base}/installXray`, { version: wanted }, onChanged),
    });
  };

  const confirmGeofile = (fileName: string) =>
    modal.confirm({
      title: t('pages.index.geofileUpdateDialog'),
      content: fileName
        ? t('pages.index.geofileUpdateDialogDesc').replace('#filename#', fileName)
        : t('pages.index.geofilesUpdateDialogDesc'),
      okText: t('confirm'),
      cancelText: t('cancel'),
      onOk: () => run(`geo-${fileName}`, `${base}/geofile`, { fileName }),
    });

  return (
    <Spin spinning={loading}>
      {modalContextHolder}
      <Space orientation="vertical" style={{ width: '100%' }} size="middle">
        <Alert type="info" showIcon title={t('pages.nodes.remote.xrayTemplateHint')} />
        {error && <Alert type="error" showIcon title={error} />}
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => void load()}>
            {loaded ? t('refresh') : t('pages.nodes.remote.loadSettings')}
          </Button>
          {loaded && (
            <Button type="primary" icon={<SaveOutlined />} loading={busy === 'save'} onClick={save}>
              {t('save')}
            </Button>
          )}
          <Button
            danger
            icon={<PoweroffOutlined />}
            loading={busy === 'stop'}
            onClick={confirmStop}
          >
            {t('pages.index.stopXray')}
          </Button>
        </Space>
        {loaded && (
          <>
            <Input
              addonBefore={t('pages.xray.outboundTestUrl')}
              value={outboundTestUrl}
              onChange={(e) => setOutboundTestUrl(e.target.value)}
            />
            <Input.TextArea
              rows={18}
              spellCheck={false}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            />
          </>
        )}
        <Typography.Title level={5} style={{ margin: 0 }}>
          {t('pages.index.xrayUpdates')}
        </Typography.Title>
        <Space wrap>
          <AutoComplete
            value={version}
            onChange={setVersion}
            options={versions.map((v) => ({ value: v }))}
            placeholder={t('pages.index.xraySwitch')}
            style={{ width: 200 }}
            filterOption={(input, option) => (option?.value ?? '').includes(input.trim())}
          />
          <Button
            icon={<DownloadOutlined />}
            disabled={!version.trim()}
            loading={busy === 'install'}
            onClick={confirmInstall}
          >
            {t('install')}
          </Button>
        </Space>
        <Space wrap>
          <Button loading={busy === 'geo-'} onClick={() => confirmGeofile('')}>
            {t('pages.index.geofilesUpdateAll')}
          </Button>
          {GEOFILES.map((file) => (
            <Button
              key={file}
              loading={busy === `geo-${file}`}
              onClick={() => confirmGeofile(file)}
            >
              {file}
            </Button>
          ))}
        </Space>
      </Space>
    </Spin>
  );
}
