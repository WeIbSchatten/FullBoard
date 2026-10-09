export function parseLoginTicket(hash: string): string {
  return new URLSearchParams(hash.replace(/^#/, '')).get('loginTicket') ?? '';
}
