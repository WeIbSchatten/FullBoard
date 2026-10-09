import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  CloudDownloadOutlined,
  PlayCircleOutlined,
  PoweroffOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SyncOutlined,
} from '@ant-design/icons';

import type { RelayStatus, RelayUnitStatus } from '@/generated/types';
import { useTgWebProxyMutations } from '@/api/queries/useTgWebProxy';
import InstallModal from './InstallModal';
import type { ModalApi } from './types';

const METRIC_KEYS = [
  'tproxy_sessions_live',
  'tproxy_streams_live',
  'tproxy_backend_dials_in_flight',
  'tproxy_pending_bytes',
];

function unitBadge(state: string): 'success' | 'processing' | 'error' | 'default' {
  if (state === 'active') return 'success';
  if (state === 'activating' || state === 'reloading') return 'processing';
  if (state === 'failed') return 'error';
  return 'default';
}

export default function OverviewTab({ status, modal }: { status: RelayStatus; modal: ModalApi }) {
  const { t } = useTranslation();
  const { controlUnit, check, update, pending } = useTgWebProxyMutations();
  const [installOpen, setInstallOpen] = useState(false);
  const admin = status.admin;
  const job = status.job;

  const confirmUpdate = () =>
    modal.confirm({
      title: t('pages.tgWebProxy.updateConfirm'),
      okText: t('confirm'),
      cancelText: t('cancel'),
      onOk: () => update(),
    });

  const unitColumns = [
    {
      title: t('pages.tgWebProxy.unit'),
      dataIndex: 'unit',
      key: 'unit',
      render: (unit: string) => <Typography.Text code>{unit}</Typography.Text>,
    },
    {
      title: t('status'),
      key: 'state',
      render: (_: unknown, u: RelayUnitStatus) => (
        <Badge status={unitBadge(u.activeState)} text={`${u.activeState}/${u.subState || '-'}`} />
      ),
    },
    {
      title: t('pages.tgWebProxy.autostart'),
      dataIndex: 'unitFileState',
      key: 'unitFileState',
      render: (v: string) => v || '-',
    },
    {
      title: t('pages.tgWebProxy.since'),
      dataIndex: 'since',
      key: 'since',
      render: (v: string) => v || '-',
    },
    {
      title: '',
      key: 'actions',
      render: (_: unknown, u: RelayUnitStatus) =>
        u.controllable ? (
          <Space wrap size={4}>
            <Button
              size="small"
              icon={<PlayCircleOutlined />}
              disabled={pending}
              onClick={() => controlUnit(u.unit, 'start')}
            >
              {t('pages.tgWebProxy.actions.start')}
            </Button>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              disabled={pending}
              onClick={() => controlUnit(u.unit, 'restart')}
            >
              {t('pages.tgWebProxy.actions.restart')}
            </Button>
            <Button
              size="small"
              danger
              icon={<PoweroffOutlined />}
              disabled={pending}
              onClick={() => controlUnit(u.unit, 'stop')}
            >
              {t('pages.tgWebProxy.actions.stop')}
            </Button>
            <Button
              size="small"
              disabled={pending}
              onClick={() =>
                controlUnit(u.unit, u.unitFileState === 'enabled' ? 'disable' : 'enable')
              }
            >
              {u.unitFileState === 'enabled'
                ? t('pages.tgWebProxy.actions.disable')
                : t('pages.tgWebProxy.actions.enable')}
            </Button>
          </Space>
        ) : null,
    },
  ];

  return (
    <Row gutter={[16, 16]}>
      {status.configError && (
        <Col span={24}>
          <Alert type="error" showIcon message={status.configError} />
        </Col>
      )}
      {status.profilesExists && !status.profilesModeOk && (
        <Col span={24}>
          <Alert
            type="error"
            showIcon
            message={t('pages.tgWebProxy.profilesModeBad', { mode: status.profilesMode })}
          />
        </Col>
      )}
      <Col span={24}>
        <Card size="small" className="summary-card">
          <Row gutter={[16, 12]}>
            <Col xs={12} md={6}>
              <Statistic
                title={t('pages.tgWebProxy.installed')}
                value={
                  status.binaryInstalled ? t('pages.tgWebProxy.yes') : t('pages.tgWebProxy.no')
                }
              />
            </Col>
            <Col xs={12} md={6}>
              <Statistic
                title={t('pages.tgWebProxy.health')}
                value={
                  !admin?.reachable
                    ? t('pages.tgWebProxy.unreachable')
                    : admin.healthy
                      ? 'OK'
                      : t('pages.tgWebProxy.unhealthy')
                }
              />
            </Col>
            <Col xs={12} md={6}>
              <Statistic
                title={t('pages.tgWebProxy.readiness')}
                value={admin?.ready ? 'OK' : t('pages.tgWebProxy.notReady')}
              />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title={t('pages.tgWebProxy.profileCount')} value={status.profileCount} />
            </Col>
          </Row>
        </Card>
      </Col>

      <Col xs={24} lg={14}>
        <Card
          size="small"
          title={t('pages.tgWebProxy.services')}
          extra={
            <Space>
              <Button
                size="small"
                icon={<SafetyCertificateOutlined />}
                disabled={!status.binaryInstalled || pending}
                onClick={() => check()}
              >
                {t('pages.tgWebProxy.actions.check')}
              </Button>
              {status.binaryInstalled ? (
                <Button
                  size="small"
                  icon={<SyncOutlined />}
                  disabled={!status.supported || job.state === 'running'}
                  onClick={confirmUpdate}
                >
                  {t('pages.tgWebProxy.actions.update')}
                </Button>
              ) : (
                <Button
                  size="small"
                  type="primary"
                  icon={<CloudDownloadOutlined />}
                  disabled={!status.supported || job.state === 'running'}
                  onClick={() => setInstallOpen(true)}
                >
                  {t('pages.tgWebProxy.actions.install')}
                </Button>
              )}
            </Space>
          }
        >
          <Table
            rowKey="unit"
            size="small"
            pagination={false}
            dataSource={status.units}
            columns={unitColumns}
            scroll={{ x: true }}
          />
        </Card>
      </Col>

      <Col xs={24} lg={10}>
        <Card size="small" title={t('pages.tgWebProxy.relay')}>
          <Descriptions size="small" column={1}>
            <Descriptions.Item label={t('pages.tgWebProxy.hostname')}>
              {status.hostname || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.tgWebProxy.basePath')}>
              {status.basePath || '/'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.tgWebProxy.adminListen')}>
              <Typography.Text code>{admin?.address || '-'}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="profiles.json">
              <Space size={4}>
                <Typography.Text code>{status.profilesPath}</Typography.Text>
                {status.profilesMode && (
                  <Tag color={status.profilesModeOk ? 'green' : 'red'}>{status.profilesMode}</Tag>
                )}
              </Space>
            </Descriptions.Item>
            {admin?.readyDetail && (
              <Descriptions.Item label={t('pages.tgWebProxy.readiness')}>
                {admin.readyDetail}
              </Descriptions.Item>
            )}
            {admin?.error && (
              <Descriptions.Item label={t('pages.tgWebProxy.adminError')}>
                {admin.error}
              </Descriptions.Item>
            )}
          </Descriptions>
          <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
            {METRIC_KEYS.map((key) => (
              <Col span={12} key={key}>
                <Statistic
                  title={<Typography.Text code>{key}</Typography.Text>}
                  value={admin?.metrics?.[key] ?? '-'}
                />
              </Col>
            ))}
          </Row>
        </Card>
      </Col>

      {job.state !== 'idle' && (
        <Col span={24}>
          <Card
            size="small"
            title={
              <Space>
                {t('pages.tgWebProxy.job')}
                <Tag>{job.kind}</Tag>
                <Badge
                  status={
                    job.state === 'running'
                      ? 'processing'
                      : job.state === 'succeeded'
                        ? 'success'
                        : 'error'
                  }
                  text={job.state}
                />
              </Space>
            }
          >
            <pre className="tg-web-proxy-log">{job.log || '…'}</pre>
          </Card>
        </Col>
      )}

      <InstallModal open={installOpen} onClose={() => setInstallOpen(false)} />
    </Row>
  );
}
