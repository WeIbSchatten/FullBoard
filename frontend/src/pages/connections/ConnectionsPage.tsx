import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { ConfigProvider, Layout } from 'antd';
import { ExportOutlined, ImportOutlined, SendOutlined } from '@ant-design/icons';

import PanelTabs from '@/layouts/PanelTabs';
import { useTheme } from '@/hooks/useTheme';
import InboundsPage from '@/pages/inbounds/InboundsPage';
import XrayPage from '@/pages/xray/XrayPage';
import TgWebProxyPage from '@/pages/tg-web-proxy/TgWebProxyPage';
import './ConnectionsPage.css';

const TAB_KEYS = ['inbounds', 'outbounds', 'tg-web-proxy'] as const;
type TabKey = (typeof TAB_KEYS)[number];

function tabFromHash(hash: string): TabKey {
  const slug = hash.replace(/^#/, '');
  return (TAB_KEYS as readonly string[]).includes(slug) ? (slug as TabKey) : 'inbounds';
}

export default function ConnectionsPage() {
  const { t } = useTranslation();
  const { antdThemeConfig } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const active = tabFromHash(location.hash);

  const items = useMemo(
    () => [
      {
        key: 'inbounds',
        label: (
          <span>
            <ImportOutlined /> {t('menu.inbounds')}
          </span>
        ),
        children: <InboundsPage />,
      },
      {
        key: 'outbounds',
        label: (
          <span>
            <ExportOutlined /> {t('menu.outbounds')}
          </span>
        ),
        children: <XrayPage forceSection="outbound" />,
      },
      {
        key: 'tg-web-proxy',
        label: (
          <span>
            <SendOutlined /> {t('menu.tgWebProxy')}
          </span>
        ),
        children: <TgWebProxyPage />,
      },
    ],
    [t],
  );

  return (
    <ConfigProvider theme={antdThemeConfig}>
      <Layout className="connections-page content-area">
        <PanelTabs
          className="connections-tabs fb-segmented-tabs"
          activeKey={active}
          onChange={(key) => navigate({ pathname: '/connections', hash: key }, { replace: true })}
          items={items}
          destroyOnHidden
        />
      </Layout>
    </ConfigProvider>
  );
}
