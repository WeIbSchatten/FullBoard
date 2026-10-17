import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, ConfigProvider, Layout, Modal, Result, Spin, message } from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  GlobalOutlined,
  SettingOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';

import SectionLayout from '@/components/ui/SectionLayout';

import { useTheme } from '@/hooks/useTheme';
import { setMessageInstance } from '@/utils/messageBus';
import { useTgWebProxySnapshot, useTgWebProxyStatus } from '@/api/queries/useTgWebProxy';
import OverviewTab from './OverviewTab';
import ProfilesTab from './ProfilesTab';
import ConfigTab from './ConfigTab';
import PublicSiteTab from './PublicSiteTab';
import LogsTab from './LogsTab';
import './TgWebProxyPage.css';

export default function TgWebProxyPage() {
  const { t } = useTranslation();
  const { isDark, isUltra, antdThemeConfig } = useTheme();
  const [modal, modalContextHolder] = Modal.useModal();
  const [messageApi, messageContextHolder] = message.useMessage();
  useEffect(() => {
    setMessageInstance(messageApi);
  }, [messageApi]);

  const snapshotQuery = useTgWebProxySnapshot();
  const statusQuery = useTgWebProxyStatus();
  const status = statusQuery.data;

  const pageClass = useMemo(() => {
    const classes = ['tg-web-proxy-page'];
    if (isDark) classes.push('is-dark');
    if (isUltra) classes.push('is-ultra');
    return classes.join(' ');
  }, [isDark, isUltra]);

  const [section, setSection] = useState('overview');
  const loading = !status && !statusQuery.error;
  const fetchError = statusQuery.error ? (statusQuery.error as Error).message : '';

  return (
    <ConfigProvider theme={antdThemeConfig}>
      {messageContextHolder}
      {modalContextHolder}
      <Layout className={pageClass}>
        <Layout.Content id="content-layout" className="content-area">
          <Spin spinning={loading} delay={200} size="large">
            {loading ? (
              <div className="loading-spacer" />
            ) : fetchError || !status ? (
              <Result
                status="error"
                title={t('somethingWentWrong')}
                subTitle={fetchError}
                extra={
                  <Button type="primary" onClick={() => statusQuery.refetch()}>
                    {t('refresh')}
                  </Button>
                }
              />
            ) : (
              <>
                {!status.supported && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                    title={t('pages.tgWebProxy.unsupported')}
                  />
                )}
                <SectionLayout
                  active={section}
                  onChange={setSection}
                  ariaLabel={t('menu.tgWebProxy')}
                  items={[
                    {
                      key: 'overview',
                      icon: <DashboardOutlined />,
                      label: t('pages.tgWebProxy.tabs.overview'),
                    },
                    {
                      key: 'profiles',
                      icon: <UnorderedListOutlined />,
                      label: t('pages.tgWebProxy.tabs.profiles'),
                    },
                    {
                      key: 'config',
                      icon: <SettingOutlined />,
                      label: t('pages.tgWebProxy.tabs.config'),
                    },
                    {
                      key: 'publicSite',
                      icon: <GlobalOutlined />,
                      label: t('pages.tgWebProxy.tabs.publicSite'),
                    },
                    {
                      key: 'logs',
                      icon: <FileTextOutlined />,
                      label: t('pages.tgWebProxy.tabs.logs'),
                    },
                  ]}
                >
                  {section === 'overview' && <OverviewTab status={status} modal={modal} />}
                  {section === 'profiles' && (
                    <ProfilesTab
                      snapshot={snapshotQuery.data}
                      loading={snapshotQuery.isFetching}
                      modal={modal}
                    />
                  )}
                  {section === 'config' &&
                    (snapshotQuery.data ? (
                      <ConfigTab key={snapshotQuery.dataUpdatedAt} snapshot={snapshotQuery.data} />
                    ) : (
                      <Spin />
                    ))}
                  {section === 'publicSite' && <PublicSiteTab disabled={!status.supported} />}
                  {section === 'logs' && <LogsTab disabled={!status.supported} />}
                </SectionLayout>
              </>
            )}
          </Spin>
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  );
}
