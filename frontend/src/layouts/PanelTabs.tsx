import { Tabs, type TabsProps } from 'antd';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useNavLayout } from '@/layouts/NavLayoutContext';

/** Page-level Tabs: left rail only for top-nav on wide screens; otherwise top. */
export default function PanelTabs(props: TabsProps) {
  const { navPosition } = useNavLayout();
  const { isMobile: narrow } = useMediaQuery(991);
  const tabPosition = navPosition === 'top' && !narrow ? 'left' : 'top';
  return <Tabs tabPosition={tabPosition} {...props} />;
}
