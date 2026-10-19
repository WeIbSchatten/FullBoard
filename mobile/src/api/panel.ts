import type {
  ClientPageResponse,
  ClientRecord,
  Inbound,
  NodeView,
  RelaySnapshot,
  RelayStatus,
  TgWebProxyBindingList,
} from '@panel/types';

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
  return {
    status: () => get<ServerStatus>('/panel/api/server/status'),
    restartXray: () => post<unknown>('/panel/api/server/restartXrayService'),
    subSettings: () => post<SubSettings>('/panel/api/setting/defaultSettings'),
    restartPanel: () => post<unknown>('/panel/api/setting/restartPanel'),

    clients: (page: number, search: string) =>
      get<ClientPageResponse>(
        `/panel/api/clients/list/paged?page=${page}&pageSize=50&search=${enc(search)}`,
      ),
    client: (email: string) => get<ClientDetail>(`/panel/api/clients/get/${enc(email)}`),
    clientLinks: (email: string) => get<string[]>(`/panel/api/clients/links/${enc(email)}`),
    setClientsEnabled: (emails: string[], enable: boolean) =>
      post<BulkResult>(`/panel/api/clients/${enable ? 'bulkEnable' : 'bulkDisable'}`, { emails }),
    resetTraffic: (email: string) => post<unknown>(`/panel/api/clients/resetTraffic/${enc(email)}`),
    deleteClient: (email: string) => post<unknown>(`/panel/api/clients/del/${enc(email)}`),
    addClient: (client: NewClient, inboundIds: number[]) =>
      post<unknown>('/panel/api/clients/add', { client, inboundIds }),

    inbounds: () => get<Inbound[]>('/panel/api/inbounds/list/slim'),
    setInboundEnabled: (id: number, enable: boolean) =>
      post<unknown>(`/panel/api/inbounds/setEnable/${id}`, { enable }),

    nodes: () => get<NodeView[]>('/panel/api/nodes/list'),
    setNodeEnabled: (id: number, enable: boolean) =>
      post<unknown>(`/panel/api/nodes/setEnable/${id}`, { enable }),

    webProxyStatus: () => get<RelayStatus>('/panel/api/tgWebProxy/status'),
    webProxyConfig: () => get<RelaySnapshot>('/panel/api/tgWebProxy/config'),
    webProxyBindings: () => get<TgWebProxyBindingList>('/panel/api/tgWebProxy/bindings'),
  };
}

export type PanelApi = ReturnType<typeof panelApi>;
