export interface Session {
  baseUrl: string;
  token: string;
}

export type ApiErrorKind = 'input' | 'network' | 'unauthorized' | 'notFound' | 'http' | 'panel';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: ApiErrorKind,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;

// Accepts what people paste from the browser: no scheme, trailing slash, or the
// /panel page itself. The secret web base path is kept.
export function normalizeBaseUrl(input: string): string {
  let url = input.trim();
  if (!url) throw new ApiError('Enter the panel address', 'input');
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  url = url.replace(/\/+$/, '').replace(/\/panel$/, '');
  return url;
}

export async function apiRequest<T>(
  session: Session,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  fetchImpl: FetchImpl = fetch,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${session.token}`,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetchImpl(session.baseUrl + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    throw new ApiError(err instanceof Error ? err.message : String(err), 'network');
  }
  if (res.status === 401) throw new ApiError('The API token was rejected', 'unauthorized', 401);
  if (res.status === 404) throw new ApiError('Not found: check the address and base path', 'notFound', 404);
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, 'http', res.status);

  const msg = (await res.json()) as { success?: boolean; msg?: string; obj?: T };
  if (!msg.success) throw new ApiError(msg.msg || 'The panel refused the request', 'panel');
  return msg.obj as T;
}
