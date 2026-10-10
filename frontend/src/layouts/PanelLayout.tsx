import { Outlet } from 'react-router';
import { Layout } from 'antd';

import { useWebSocketBridge } from '@/api/websocketBridge';
import { usePageTitle } from '@/hooks/usePageTitle';
import CommandPalette from '@/components/command-palette/CommandPalette';
import AppSidebar from '@/layouts/AppSidebar';
import { NavLayoutProvider, useNavLayout } from '@/layouts/NavLayoutContext';

function PanelChrome() {
  const { navPosition } = useNavLayout();
  return (
    <Layout className={`panel-chrome panel-chrome--${navPosition}`} style={{ minHeight: '100vh' }}>
      <AppSidebar />
      <Layout className="content-shell">
        <Outlet />
      </Layout>
    </Layout>
  );
}

export default function PanelLayout() {
  useWebSocketBridge();
  usePageTitle();
  return (
    <NavLayoutProvider>
      <PanelChrome />
      <CommandPalette />
    </NavLayoutProvider>
  );
}
