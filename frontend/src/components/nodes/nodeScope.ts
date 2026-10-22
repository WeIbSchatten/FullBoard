// A tab on the clients and inbounds pages: this panel, or one connected node.
export type NodeScope = 'local' | number;

export interface NodeScopeTab {
  id: number;
  name: string;
  online: boolean;
}

interface NodeLike {
  id: number;
  name?: string;
  status?: string;
}

// Known nodes first, then ids that only orphaned inbounds still point at.
export function nodeScopeTabs(
  nodes: NodeLike[],
  inboundNodeIds: Iterable<number | null | undefined>,
): NodeScopeTab[] {
  const tabs = nodes.map((n) => ({
    id: n.id,
    name: n.name || `#${n.id}`,
    online: n.status === 'online',
  }));
  const seen = new Set(tabs.map((tab) => tab.id));
  for (const id of inboundNodeIds) {
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    tabs.push({ id, name: `#${id}`, online: false });
  }
  return tabs;
}

export function inNodeScope(nodeId: number | null | undefined, scope: NodeScope): boolean {
  return scope === 'local' ? nodeId == null : nodeId === scope;
}

// undefined means the panel has no nodes, so there are no tabs and nothing to scope.
export function nodeScopeParam(raw: string | null, tabs: NodeScopeTab[]): NodeScope | undefined {
  if (tabs.length === 0) return undefined;
  const id = Number(raw);
  return raw && tabs.some((tab) => tab.id === id) ? id : 'local';
}
