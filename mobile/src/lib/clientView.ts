import type { ClientDetail, SubSettings } from '@/api/panel';
import { clientState, type ClientState } from './clientState';
import { quotaUsage } from './format';

export interface ClientView {
  client: ClientDetail['client'];
  state: ClientState;
  usage: ReturnType<typeof quotaUsage>;
  subUrl: string;
  jsonUrl: string;
}

export function clientView(
  detail: ClientDetail,
  traffic: { up: number; down: number } | null | undefined,
  sub: SubSettings | undefined,
  now = Date.now(),
): ClientView {
  const { client } = detail;
  const subId = client.subId;
  return {
    client,
    state: clientState(client, traffic, now),
    usage: quotaUsage(client.totalGB, traffic),
    subUrl: subId && sub?.subEnable && sub.subURI ? sub.subURI + subId : '',
    jsonUrl: subId && sub?.subJsonEnable && sub.subJsonURI ? sub.subJsonURI + subId : '',
  };
}
