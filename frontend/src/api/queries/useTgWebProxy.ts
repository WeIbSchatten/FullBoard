import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { keys } from '@/api/queryKeys';
import { RelayShareInfoSchema, RelaySnapshotSchema, RelayStatusSchema } from '@/generated/zod';
import type {
  RelayApplyResult,
  RelayConfig,
  RelayInstallRequest,
  RelayJobStatus,
  RelayProfile,
  RelayShareInfo,
  RelaySnapshot,
  RelayStatus,
} from '@/generated/types';
import { HttpUtil } from '@/utils';
import { parseMsg } from '@/utils/zodValidate';

const BASE = '/panel/api/tgWebProxy';
const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } };

async function fetchStatus(): Promise<RelayStatus> {
  const msg = await HttpUtil.get(`${BASE}/status`, undefined, { silent: true });
  if (!msg?.success) throw new Error(msg?.msg || 'Failed to fetch tg-web-proxy status');
  const validated = parseMsg(msg, RelayStatusSchema, 'tgWebProxy/status');
  if (!validated.obj) throw new Error('Empty tg-web-proxy status');
  return validated.obj;
}

async function fetchSnapshot(): Promise<RelaySnapshot> {
  const msg = await HttpUtil.get(`${BASE}/config`, undefined, { silent: true });
  if (!msg?.success) throw new Error(msg?.msg || 'Failed to fetch tg-web-proxy config');
  const validated = parseMsg(msg, RelaySnapshotSchema, 'tgWebProxy/config');
  if (!validated.obj) throw new Error('Empty tg-web-proxy config');
  return validated.obj;
}

export function useTgWebProxyStatus() {
  return useQuery({
    queryKey: keys.tgWebProxy.status(),
    queryFn: fetchStatus,
    refetchInterval: (query) => (query.state.data?.job.state === 'running' ? 3000 : 10000),
  });
}

export function useTgWebProxySnapshot() {
  return useQuery({ queryKey: keys.tgWebProxy.config(), queryFn: fetchSnapshot });
}

export async function fetchShare(name: string): Promise<RelayShareInfo | null> {
  const msg = await HttpUtil.get(`${BASE}/share/${encodeURIComponent(name)}`);
  if (!msg?.success) return null;
  return parseMsg(msg, RelayShareInfoSchema, 'tgWebProxy/share').obj ?? null;
}

export async function fetchLogs(unit: string, lines: number): Promise<string> {
  const msg = await HttpUtil.get<string>(`${BASE}/logs/${unit}`, { lines });
  return msg?.success && typeof msg.obj === 'string' ? msg.obj : '';
}

export function useTgWebProxyMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: keys.tgWebProxy.root() });
  const onSuccess = (msg: { success?: boolean } | undefined) => {
    if (msg?.success) invalidate();
  };

  const saveConfig = useMutation({
    mutationFn: (payload: { config: RelayConfig; initialProfile?: RelayProfile }) =>
      HttpUtil.post<RelayApplyResult>(`${BASE}/config`, payload, JSON_HEADERS),
    onSuccess,
  });
  const check = useMutation({ mutationFn: () => HttpUtil.post(`${BASE}/check`) });
  const addProfile = useMutation({
    mutationFn: (profile: RelayProfile) =>
      HttpUtil.post<RelayApplyResult>(`${BASE}/profiles/add`, profile, JSON_HEADERS),
    onSuccess,
  });
  const updateProfile = useMutation({
    mutationFn: ({ name, profile }: { name: string; profile: RelayProfile }) =>
      HttpUtil.post<RelayApplyResult>(
        `${BASE}/profiles/update/${encodeURIComponent(name)}`,
        profile,
        JSON_HEADERS,
      ),
    onSuccess,
  });
  const deleteProfile = useMutation({
    mutationFn: (name: string) =>
      HttpUtil.post<RelayApplyResult>(`${BASE}/profiles/del/${encodeURIComponent(name)}`),
    onSuccess,
  });
  const controlUnit = useMutation({
    mutationFn: ({ unit, action }: { unit: string; action: string }) =>
      HttpUtil.post(`${BASE}/service/${unit}/${action}`),
    onSuccess,
  });
  const install = useMutation({
    mutationFn: (req: RelayInstallRequest) =>
      HttpUtil.post<RelayJobStatus>(`${BASE}/install`, req, JSON_HEADERS),
    onSuccess,
  });
  const update = useMutation({
    mutationFn: () => HttpUtil.post<RelayJobStatus>(`${BASE}/update`),
    onSuccess,
  });

  return {
    saveConfig: saveConfig.mutateAsync,
    check: check.mutateAsync,
    addProfile: addProfile.mutateAsync,
    updateProfile: (name: string, profile: RelayProfile) =>
      updateProfile.mutateAsync({ name, profile }),
    deleteProfile: deleteProfile.mutateAsync,
    controlUnit: (unit: string, action: string) => controlUnit.mutateAsync({ unit, action }),
    install: install.mutateAsync,
    update: update.mutateAsync,
    pending:
      saveConfig.isPending ||
      addProfile.isPending ||
      updateProfile.isPending ||
      deleteProfile.isPending ||
      controlUnit.isPending ||
      install.isPending ||
      update.isPending,
  };
}
