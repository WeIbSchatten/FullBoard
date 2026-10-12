import { Tabs, type TabsProps } from 'antd';

/** Page-level tabs stay horizontal so top-nav chrome and Connections segmented strips stay aligned. */
export default function PanelTabs(props: TabsProps) {
  return <Tabs tabPosition="top" {...props} />;
}
