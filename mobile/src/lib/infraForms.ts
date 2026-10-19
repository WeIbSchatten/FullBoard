export interface NodeForm {
  name: string;
  remark: string;
  address: string;
  port: string;
  basePath: string;
  apiToken: string;
  enable: boolean;
  allowPrivateAddress: boolean;
}

function portOf(raw: string, field: string, fallback: number): number {
  if (!raw.trim()) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error(`${field}: 1-65535`);
  return n;
}

// Accepts a pasted panel URL ("https://host:port/path") as well as a bare host.
export function nodePayload(f: NodeForm) {
  const name = f.name.trim();
  if (!name) throw new Error('name: required');
  const raw = f.address.trim();
  if (!raw) throw new Error('address: required');
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const m = /^(https?):\/\/([^/:]+)(?::(\d+))?(\/.*)?$/i.exec(url);
  if (!m) throw new Error('address: invalid');
  const [, scheme, host, urlPort, urlPath] = m;
  const port = portOf(f.port || urlPort || '', 'port', 2053);
  const basePath = f.basePath.trim() || urlPath || '/';
  return {
    name,
    remark: f.remark.trim(),
    scheme: scheme.toLowerCase(),
    address: host,
    port,
    basePath,
    apiToken: f.apiToken.trim(),
    clearApiToken: false,
    enable: f.enable,
    allowPrivateAddress: f.allowPrivateAddress,
  };
}

export interface HostGroupForm {
  remark: string;
  hosts: string;
  port: string;
  security: string;
  sni: string;
  path: string;
  hostHeader: string;
  inboundIds: number[];
  isDisabled: boolean;
}

export function hostGroupPayload(stored: Record<string, unknown> | undefined, f: HostGroupForm) {
  const hosts = f.hosts
    .split(/[\s,]+/)
    .map((h) => h.trim())
    .filter(Boolean);
  if (!hosts.length) throw new Error('hosts: required');
  if (!f.inboundIds.length) throw new Error('inboundIds: required');
  const port = f.port.trim() ? portOf(f.port, 'port', 0) : 0;
  return {
    ...(stored ?? {}),
    remark: f.remark.trim(),
    hosts,
    port,
    security: f.security,
    sni: f.sni.trim(),
    path: f.path.trim(),
    hostHeader: f.hostHeader.trim(),
    inboundIds: f.inboundIds,
    isDisabled: f.isDisabled,
  };
}
