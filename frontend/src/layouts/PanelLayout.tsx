import { Outlet } from 'react-router';
import { ConfigProvider, Layout } from 'antd';

import { useWebSocketBridge } from '@/api/websocketBridge';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useTheme } from '@/hooks/useTheme';
import CommandPalette from '@/components/command-palette/CommandPalette';
import AppSidebar from '@/layouts/AppSidebar';
import PanelTopBar from '@/layouts/PanelTopBar';
import { NavLayoutProvider, useNavLayout } from '@/layouts/NavLayoutContext';
import { MobileNavProvider } from '@/layouts/MobileNavContext';
import './PanelChrome.css';

function PanelChrome() {
  const { navPosition } = useNavLayout();
  return (
    <Layout
      className={`panel-chrome panel-chrome--${navPosition}`}
      hasSider={navPosition === 'side'}
    >
      <AppSidebar />
      <Layout className="content-shell">
        <PanelTopBar />
        <main className="content-main">
          <Outlet />
        </main>
      </Layout>
    </Layout>
  );
}

export default function PanelLayout() {
  useWebSocketBridge();
  usePageTitle();
  const { antdThemeConfig } = useTheme();
  return (
    <ConfigProvider theme={antdThemeConfig}>
      <NavLayoutProvider>
        <MobileNavProvider>
          <PanelChrome />
          <CommandPalette />
        </MobileNavProvider>
      </NavLayoutProvider>
    </ConfigProvider>
  );
}
