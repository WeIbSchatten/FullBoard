import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, InputNumber, Segmented, Select, Space } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

import { HttpUtil } from '@/utils';

type LogSource = 'panel' | 'xray';

interface XrayLogEntry {
  DateTime?: string;
  FromAddress?: string;
  ToAddress?: string;
  Inbound?: string;
  Outbound?: string;
  Email?: string;
}

function formatXrayLogEntry(e: XrayLogEntry): string {
  const route = [e.Inbound, e.Outbound].filter(Boolean).join(' >> ');
  return [e.DateTime, e.FromAddress, '->', e.ToAddress, route && `[${route}]`, e.Email]
    .filter(Boolean)
    .join(' ');
}

interface RemoteLogsTabProps {
  nodeId: number;
}

export default function RemoteLogsTab({ nodeId }: RemoteLogsTabProps) {
  const { t } = useTranslation();
  const [source, setSource] = useState<LogSource>('panel');
  const [count, setCount] = useState(100);
  const [level, setLevel] = useState('info');
  const [filter, setFilter] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const msg = await HttpUtil.post<string[] | XrayLogEntry[]>(
        `/panel/api/nodes/remote/${nodeId}/logs`,
        { source, count, level, filter },
        { headers: { 'Content-Type': 'application/json' }, silent: true, silentSuccess: true },
      );
      if (!msg?.success) {
        setText(msg?.msg ?? '');
        return;
      }
      const rows = Array.isArray(msg.obj) ? msg.obj : [];
      setText(
        rows.map((row) => (typeof row === 'string' ? row : formatXrayLogEntry(row))).join('\n'),
      );
    } finally {
      setLoading(false);
    }
  }, [nodeId, source, count, level, filter]);

  useEffect(() => {
    void load();
    // Reload when the stream changes; count/level/filter wait for the Refresh button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <Space wrap>
        <Segmented<LogSource>
          value={source}
          onChange={setSource}
          options={[
            { value: 'panel', label: t('pages.index.logs') },
            { value: 'xray', label: t('pages.index.accessLogs') },
          ]}
        />
        <InputNumber
          min={1}
          max={10000}
          value={count}
          onChange={(v) => setCount(v ?? 100)}
          aria-label={t('pages.nodes.remote.logLines')}
          addonBefore={t('pages.nodes.remote.logLines')}
        />
        {source === 'panel' ? (
          <Select
            value={level}
            onChange={setLevel}
            style={{ width: 120 }}
            options={[
              { value: 'debug', label: t('pages.index.logLevelDebug') },
              { value: 'info', label: t('pages.index.logLevelInfo') },
              { value: 'notice', label: t('pages.index.logLevelNotice') },
              { value: 'warning', label: t('pages.index.logLevelWarning') },
              { value: 'err', label: t('pages.index.logLevelError') },
            ]}
          />
        ) : (
          <Input
            allowClear
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('search')}
            style={{ width: 200 }}
          />
        )}
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>
          {t('refresh')}
        </Button>
      </Space>
      <Input.TextArea
        readOnly
        rows={22}
        spellCheck={false}
        value={text}
        style={{ fontFamily: 'monospace', fontSize: 12 }}
      />
    </Space>
  );
}
