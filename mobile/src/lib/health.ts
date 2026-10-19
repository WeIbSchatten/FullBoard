export interface HealthSnapshot {
  xrayRunning: boolean;
  nodes: Record<string, { name: string; online: boolean }>;
}

export type HealthAlert =
  | { kind: 'xrayDown' | 'xrayUp' }
  | { kind: 'nodeDown' | 'nodeUp'; node: string };

export function healthAlerts(prev: HealthSnapshot | undefined, next: HealthSnapshot): HealthAlert[] {
  if (!prev) return [];
  const out: HealthAlert[] = [];
  if (prev.xrayRunning !== next.xrayRunning) out.push({ kind: next.xrayRunning ? 'xrayUp' : 'xrayDown' });
  for (const [id, node] of Object.entries(next.nodes)) {
    const before = prev.nodes[id];
    if (before && before.online !== node.online) out.push({ kind: node.online ? 'nodeUp' : 'nodeDown', node: node.name });
  }
  return out;
}
