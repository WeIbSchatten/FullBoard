import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, InputNumber, Select, Space } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

import { keys } from '@/api/queryKeys';
import { fetchLogs } from '@/api/queries/useTgWebProxy';

const UNITS = ['tproxy-server', 'mtproxy', 'caddy', 'tproxy-firewall'];

export default function LogsTab({ disabled }: { disabled: boolean }) {
  const { t } = useTranslation();
  const [unit, setUnit] = useState(UNITS[0]);
  const [lines, setLines] = useState(200);
  const logs = useQuery({
    queryKey: keys.tgWebProxy.logs(unit, lines),
    queryFn: () => fetchLogs(unit, lines),
    enabled: !disabled,
  });

  return (
    <Card
      size="small"
      title={t('pages.tgWebProxy.tabs.logs')}
      extra={
        <Space wrap>
          <Select
            size="small"
            value={unit}
            onChange={setUnit}
            style={{ width: 160 }}
            options={UNITS.map((u) => ({ value: u, label: u }))}
          />
          <InputNumber
            size="small"
            min={10}
            max={1000}
            value={lines}
            onChange={(v) => setLines(v ?? 200)}
          />
          <Button
            size="small"
            icon={<ReloadOutlined />}
            loading={logs.isFetching}
            disabled={disabled}
            onClick={() => void logs.refetch()}
          >
            {t('refresh')}
          </Button>
        </Space>
      }
    >
      <pre className="tg-web-proxy-log">{logs.data || t('noData')}</pre>
    </Card>
  );
}
