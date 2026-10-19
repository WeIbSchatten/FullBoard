import type {
  ClientPageResponse,
  OutboundTraffics,
  RelayApplyResult,
  RelayProfile,
  RelayShareInfo,
  ClientRecord,
  Inbound,
  NodeView,
  RelaySnapshot,
  RelayStatus,
  TgWebProxyBindingList,
} from '@panel/types';

import { parseTemplateResponse } from '@/lib/xrayConfig';

import { apiRequest, type Session } from './client';

// Subset of the panel's /server/status payload the app shows.
export interface ServerStatus {
  cpu: number;
  cpuCores: number;
  mem: { current: number; total: number };
  swap: { current: number; total: number };
  disk: { current: number; total: number };
  xray: { state: string; errorMsg: string; version: string };
  uptime: number;
  loads: number[];
  tcpCount: number;
  udpCount: number;
  netIO: { up: number; down: number };
  netTraffic: { sent: number; recv: number };
  panelVersion: string;
}

// Subscription base URLs the panel computes for the requesting host.
export interface SubSettings {
  subEnable: boolean;
  subURI: string;
  subJsonEnable: boolean;
  subJsonURI: string;
}

// /clients/get wraps the record together with what it is attached to.
export interface ClientDetail {
  client: Pick<ClientRecord, 'email' | 'subId' | 'enable' | 'totalGB' | 'expiryTime'> & Partial<ClientRecord>;
  inboundIds: number[];
  externalLinks: unknown[];
}

export interface BulkResult {
  changed: number;
  skipped?: { email: string; reason: string }[];
}

export interface OutboundTestResult {
  tag?: string;
  success: boolean;
  delay: number;
  error?: string;
}

export interface RouteTestResult {
  matched: boolean;
  outboundTag: string;
  groupTags?: string[];
}

export interface ClientGroup {
  name: string;
  clientCount: number;
}

export interface ClientIp {
  ip: string;
  time: string;
  node: string;
}

export interface HwidDevice {
  id: number;
  firstSeen: number;
  lastSeen: number;
  userAgent: string;
  deviceOs: string;
  osVersion: string;
  deviceModel: string;
  fingerprint: string;
}

export type ClientFilter = 'online' | 'active' | 'deactive' | 'depleted' | 'expiring';

export interface ClientQuery {
  search: string;
  filters: ClientFilter[];
  group: string;
}

export interface NewClient {
  email: string;
  totalGB: number;
  expiryTime: number;
  limitIp: number;
  comment: string;
  enable: boolean;
}

const enc = encodeURIComponent;

export function panelApi(s: Session) {
  const get = <T>(path: string) => apiRequest<T>(s, 'GET', path);
  const post = <T>(path: string, body?: unknown) => apiRequest<T>(s, 'POST', path, body);
  const del = <T>(path: string) => apiRequest<T>(s, 'DELETE', path);
  const form = <T>(path: string, fields: Record<string, string>) =>
    apiRequest<T>(s, 'POST', path, new URLSearchParams(fields));
  return {
    status: () => get<ServerStatus>('/panel/api/server/status'),
    restartXray: () => post<unknown>('/panel/api/server/restartXrayService'),
    subSettings: () => post<SubSettings>('/panel/api/setting/defaultSettings'),
    restartPanel: () => post<unknown>('/panel/api/setting/restartPanel'),

    clients: (page: number, q: Partial<ClientQuery> = {}) => {
      const params = [`page=${page}`, 'pageSize=50', `search=${enc(q.search ?? '')}`];
      if (q.filters?.length) params.push(`filter=${q.filters.join(',')}`);
      if (q.group) params.push(`group=${enc(q.group)}`);
      return get<ClientPageResponse>(`/panel/api/clients/list/paged?${params.join('&')}`);
    },
    updateClient: (email: string, client: Record<string, unknown>) =>
      post<unknown>(`/panel/api/clients/update/${enc(email)}`, client),
    attachClient: (email: string, inboundIds: number[]) =>
      post<unknown>(`/panel/api/clients/${enc(email)}/attach`, { inboundIds }),
    detachClient: (email: string, inboundIds: number[]) =>
      post<unknown>(`/panel/api/clients/${enc(email)}/detach`, { inboundIds }),
    clientIps: (email: string) => post<ClientIp[] | null>(`/panel/api/clients/ips/${enc(email)}`),
    clearClientIps: (email: string) => post<unknown>(`/panel/api/clients/clearIps/${enc(email)}`),
    clientHwids: (email: string) => post<HwidDevice[] | null>(`/panel/api/clients/hwids/${enc(email)}`),
    deleteHwid: (email: string, id: number) => del<unknown>(`/panel/api/clients/hwids/${enc(email)}/${id}`),
    clearHwids: (email: string) => del<unknown>(`/panel/api/clients/hwids/${enc(email)}`),
    onlines: () => post<string[] | null>('/panel/api/clients/onlines'),
    bulkDelete: (emails: string[]) => post<unknown>('/panel/api/clients/bulkDel', { emails, keepTraffic: false }),
    bulkResetTraffic: (emails: string[]) => post<unknown>('/panel/api/clients/bulkResetTraffic', { emails }),
    groups: () => get<ClientGroup[] | null>('/panel/api/clients/groups'),
    createGroup: (name: string) => post<unknown>('/panel/api/clients/groups/create', { name }),
    renameGroup: (oldName: string, newName: string) =>
      post<unknown>('/panel/api/clients/groups/rename', { oldName, newName }),
    deleteGroup: (name: string) => post<unknown>('/panel/api/clients/groups/delete', { name }),
    resetGroupTraffic: (name: string) => post<unknown>('/panel/api/clients/groups/resetTraffic', { name }),
    addToGroup: (emails: string[], group: string) =>
      post<unknown>('/panel/api/clients/groups/bulkAdd', { emails, group }),
    removeFromGroup: (emails: string[]) => post<unknown>('/panel/api/clients/groups/bulkRemove', { emails }),
    client: (email: string) => get<ClientDetail>(`/panel/api/clients/get/${enc(email)}`),
    clientLinks: (email: string) => get<string[]>(`/panel/api/clients/links/${enc(email)}`),
    setClientsEnabled: (emails: string[], enable: boolean) =>
      post<BulkResult>(`/panel/api/clients/${enable ? 'bulkEnable' : 'bulkDisable'}`, { emails }),
    resetTraffic: (email: string) => post<unknown>(`/panel/api/clients/resetTraffic/${enc(email)}`),
    deleteClient: (email: string) => post<unknown>(`/panel/api/clients/del/${enc(email)}`),
    addClient: (client: NewClient, inboundIds: number[]) =>
      post<unknown>('/panel/api/clients/add', { client, inboundIds }),

    inbounds: () => get<Inbound[]>('/panel/api/inbounds/list/slim'),
    inbound: (id: number) => get<Inbound>(`/panel/api/inbounds/get/${id}`),
    addInbound: (body: Record<string, unknown>) => post<Inbound>('/panel/api/inbounds/add', body),
    updateInbound: (id: number, body: Record<string, unknown>) => post<Inbound>(`/panel/api/inbounds/update/${id}`, body),
    deleteInbound: (id: number) => post<unknown>(`/panel/api/inbounds/del/${id}`),
    resetInboundTraffic: (id: number) => post<unknown>(`/panel/api/inbounds/${id}/resetTraffic`),
    x25519: () => get<{ privateKey: string; publicKey: string }>('/panel/api/server/getNewX25519Cert'),
    setInboundEnabled: (id: number, enable: boolean) =>
      post<unknown>(`/panel/api/inbounds/setEnable/${id}`, { enable }),

    nodes: () => get<NodeView[]>('/panel/api/nodes/list'),
    setNodeEnabled: (id: number, enable: boolean) =>
      post<unknown>(`/panel/api/nodes/setEnable/${id}`, { enable }),

    xrayTemplate: async () => parseTemplateResponse(await post<unknown>('/panel/api/xray/')),
    saveXrayTemplate: (xraySetting: string, outboundTestUrl: string) =>
      form<unknown>('/panel/api/xray/update', { xraySetting, outboundTestUrl }),
    xrayResult: () => get<string>('/panel/api/xray/getXrayResult'),
    outboundsTraffic: () => get<OutboundTraffics[] | null>('/panel/api/xray/getOutboundsTraffic'),
    resetOutboundsTraffic: (tag: string) => form<unknown>('/panel/api/xray/resetOutboundsTraffic', { tag }),
    testOutbound: (outbound: unknown, allOutbounds: unknown[]) =>
      form<OutboundTestResult>('/panel/api/xray/testOutbound', {
        outbound: JSON.stringify(outbound),
        allOutbounds: JSON.stringify(allOutbounds),
        mode: 'tcp',
      }),
    routeTest: (q: { domain?: string; ip?: string; port?: string; network?: string }) =>
      form<RouteTestResult>('/panel/api/xray/routeTest', Object.fromEntries(Object.entries(q).filter(([, v]) => v)) as Record<string, string>),
    webProxyAddProfile: (p: RelayProfile) => post<RelayApplyResult>('/panel/api/tgWebProxy/profiles/add', p),
    webProxyUpdateProfile: (name: string, p: RelayProfile) =>
      post<RelayApplyResult>(`/panel/api/tgWebProxy/profiles/update/${enc(name)}`, p),
    webProxyDeleteProfile: (name: string) => post<RelayApplyResult>(`/panel/api/tgWebProxy/profiles/del/${enc(name)}`),
    webProxyShare: (name: string) => get<RelayShareInfo>(`/panel/api/tgWebProxy/share/${enc(name)}`),
    webProxyBindMany: (emails: string[], profileName: string, dedicated: boolean) =>
      post<unknown>('/panel/api/tgWebProxy/bindings/bindMany', { emails, profileName, dedicated }),
    webProxyUnbind: (email: string) => post<unknown>('/panel/api/tgWebProxy/bindings/unbind', { email }),
    webProxyUnit: (unit: string, action: string) => post<unknown>(`/panel/api/tgWebProxy/service/${enc(unit)}/${action}`),
    webProxyStatus: () => get<RelayStatus>('/panel/api/tgWebProxy/status'),
    webProxyConfig: () => get<RelaySnapshot>('/panel/api/tgWebProxy/config'),
    webProxyBindings: () => get<TgWebProxyBindingList>('/panel/api/tgWebProxy/bindings'),
  };
}

export type PanelApi = ReturnType<typeof panelApi>;
