import { Suspense, useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ConfigProvider, Layout, Spin } from 'antd';

import PanelTabs from '@/layouts/PanelTabs';
import { useTheme } from '@/hooks/useTheme';
import { legacyTarget } from '@/layouts/navModel';
import './HubPage.css';

export interface HubTab {
  key: string;
  icon?: ReactNode;
  label: ReactNode;
  render: () => ReactNode;
}

// A sidebar entry that groups related screens as top tabs; the tab lives in
// the URL hash so links and reloads land on the same screen.
export default function HubPage({
  path,
  tabs,
  className = '',
}: {
  path: string;
  tabs: HubTab[];
  className?: string;
}) {
  const { antdThemeConfig } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const slug = location.hash.replace(/^#/, '');
  const redirect = legacyTarget(location.pathname, location.hash);
  const active = tabs.some((t) => t.key === slug) ? slug : tabs[0]?.key;

  useEffect(() => {
    if (redirect) navigate(redirect + location.search, { replace: true });
  }, [redirect, navigate, location.search]);

  // A hub with one available tab (e.g. Subscriptions with JSON/Clash off) shows no strip.
  if (tabs.length === 1) {
    return (
      <ConfigProvider theme={antdThemeConfig}>
        <Layout className={`hub-page hub-page--single content-area ${className}`.trim()}>
          <Suspense fallback={<Spin size="large" className="hub-loading" />}>
            {tabs[0].render()}
          </Suspense>
        </Layout>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={antdThemeConfig}>
      <Layout className={`hub-page content-area ${className}`.trim()}>
        <PanelTabs
          className="hub-tabs fb-segmented-tabs"
          activeKey={active}
          onChange={(key) =>
            navigate(
              { pathname: path, hash: key === tabs[0]?.key ? '' : key, search: location.search },
              { replace: true },
            )
          }
          items={tabs.map((tab) => ({
            key: tab.key,
            label: (
              <span>
                {tab.icon} {tab.label}
              </span>
            ),
            children:
              tab.key === active ? (
                <Suspense fallback={<Spin size="large" className="hub-loading" />}>
                  {tab.render()}
                </Suspense>
              ) : null,
          }))}
        />
      </Layout>
    </ConfigProvider>
  );
}
