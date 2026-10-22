import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { Tabs } from 'antd';

import { nodeScopeParam, type NodeScope, type NodeScopeTab } from './nodeScope';
import './NodeScopeTabs.css';

const PARAM = 'node';

// The open tab lives in ?node= so a reload or a shared link keeps it.
export function useNodeScope(
  tabs: NodeScopeTab[],
): [NodeScope | undefined, (scope: NodeScope) => void] {
  const [params, setParams] = useSearchParams();
  const scope = nodeScopeParam(params.get(PARAM), tabs);
  const setScope = useCallback(
    (next: NodeScope) =>
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev);
          if (next === 'local') out.delete(PARAM);
          else out.set(PARAM, String(next));
          return out;
        },
        { replace: true },
      ),
    [setParams],
  );
  return [scope, setScope];
}

interface NodeScopeTabsProps {
  tabs: NodeScopeTab[];
  value: NodeScope;
  onChange: (scope: NodeScope) => void;
}

export function NodeScopeTabs({ tabs, value, onChange }: NodeScopeTabsProps) {
  const { t } = useTranslation();
  return (
    <Tabs
      className="node-scope-tabs"
      size="small"
      activeKey={String(value)}
      onChange={(key) => onChange(key === 'local' ? 'local' : Number(key))}
      items={[
        { key: 'local', label: t('pages.inbounds.localPanel') },
        ...tabs.map((tab) => ({
          key: String(tab.id),
          label: (
            <span className="node-scope-tab">
              <span className={`node-scope-dot${tab.online ? ' is-online' : ''}`} />
              {tab.name}
            </span>
          ),
        })),
      ]}
    />
  );
}

export default NodeScopeTabs;
