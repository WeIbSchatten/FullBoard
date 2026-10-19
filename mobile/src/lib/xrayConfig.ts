// The panel's Xray config template (outbounds, routing, balancers, DNS, …) is
// one JSON document saved whole through /panel/api/xray/update.
export type XrayConfig = Record<string, unknown>;
type Obj = Record<string, unknown>;

export function parseConfig(raw: string): XrayConfig {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return parsed as XrayConfig;
  } catch (e) {
    throw new Error(`xraySetting: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export function serializeConfig(cfg: XrayConfig): string {
  return JSON.stringify(cfg, null, 2);
}

function getIn(obj: Obj, keys: string[]): unknown {
  return keys.reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Obj)[k] : undefined), obj);
}

function setIn(obj: Obj, keys: string[], value: unknown): Obj {
  const [head, ...rest] = keys;
  if (!rest.length) return { ...obj, [head]: value };
  const child = obj[head] && typeof obj[head] === 'object' ? (obj[head] as Obj) : {};
  return { ...obj, [head]: setIn(child, rest, value) };
}

export function getSection(cfg: XrayConfig, path: string): unknown {
  return getIn(cfg, path.split('.'));
}

export function setSection(cfg: XrayConfig, path: string, value: unknown): XrayConfig {
  return setIn(cfg, path.split('.'), value);
}

export function listOf(cfg: XrayConfig, path: string): unknown[] {
  const v = getSection(cfg, path);
  return Array.isArray(v) ? v : [];
}

export function upsertItem(cfg: XrayConfig, path: string, index: number, item: unknown): XrayConfig {
  const list = [...listOf(cfg, path)];
  if (index < 0 || index >= list.length) list.push(item);
  else list[index] = item;
  return setSection(cfg, path, list);
}

export function removeItem(cfg: XrayConfig, path: string, index: number): XrayConfig {
  return setSection(cfg, path, listOf(cfg, path).filter((_, i) => i !== index));
}

export function moveItem(cfg: XrayConfig, path: string, index: number, delta: -1 | 1): XrayConfig {
  const list = [...listOf(cfg, path)];
  const to = index + delta;
  if (to < 0 || to >= list.length) return cfg;
  [list[index], list[to]] = [list[to], list[index]];
  return setSection(cfg, path, list);
}

export function describeOutbound(o: unknown): string {
  const ob = (o ?? {}) as Obj;
  const protocol = String(ob.protocol ?? '?');
  const settings = (ob.settings ?? {}) as Obj;
  const vnext = (settings.vnext as Obj[] | undefined)?.[0] ?? (settings.servers as Obj[] | undefined)?.[0];
  const address = vnext?.address ?? settings.address;
  const port = vnext?.port ?? settings.port;
  return address ? `${protocol} · ${String(address)}${port ? `:${String(port)}` : ''}` : protocol;
}

const RULE_MATCHERS = ['domain', 'ip', 'port', 'sourcePort', 'source', 'network', 'protocol', 'inboundTag', 'user'];

export function describeRule(r: unknown): { target: string; match: string } {
  const rule = (r ?? {}) as Obj;
  const target = rule.balancerTag ? `⚖ ${String(rule.balancerTag)}` : String(rule.outboundTag ?? '—');
  const match = RULE_MATCHERS.filter((k) => rule[k] !== undefined && rule[k] !== '')
    .map((k) => `${k}: ${Array.isArray(rule[k]) ? (rule[k] as unknown[]).join(', ') : String(rule[k])}`)
    .join(' · ');
  return { target, match };
}

export interface XrayTemplateInfo {
  xraySetting: string;
  outboundTestUrl: string;
}

// /panel/api/xray/ returns obj as a JSON string whose xraySetting is an object;
// older docs show xraySetting as a string, so accept both.
export function parseTemplateResponse(obj: unknown): XrayTemplateInfo {
  const o = (typeof obj === 'string' ? JSON.parse(obj) : obj) as Record<string, unknown>;
  const setting = o.xraySetting;
  return {
    xraySetting: typeof setting === 'string' ? setting : JSON.stringify(setting ?? {}),
    outboundTestUrl: typeof o.outboundTestUrl === 'string' ? o.outboundTestUrl : '',
  };
}
