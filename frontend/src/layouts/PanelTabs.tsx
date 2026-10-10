import { Tabs, type TabsProps } from 'antd';

import { useNavLayout } from '@/layouts/NavLayoutContext';

/** Page-level Tabs: left rail when primary nav is on top, otherwise top tabs. */
export default function PanelTabs(props: TabsProps) {
  const { tabsTabPosition } = useNavLayout();
  return <Tabs tabPosition={tabsTabPosition} {...props} />;
}
