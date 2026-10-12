import { Outlet } from 'react-router';
import { Layout } from 'antd';

import { useWebSocketBridge } from '@/api/websocketBridge';
import { usePageTitle } from '@/hooks/usePageTitle';
import CommandPalette from '@/components/command-palette/CommandPalette';
import AppSidebar from '@/layouts/AppSidebar';
import PanelTopBar from '@/layouts/PanelTopBar';
import { NavLayoutProvider, useNavLayout } from '@/layouts/NavLayoutContext';
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
        {navPosition === 'side' ? <PanelTopBar /> : null}
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
