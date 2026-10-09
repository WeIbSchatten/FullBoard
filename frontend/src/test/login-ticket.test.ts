import { describe, expect, it } from 'vitest';

import { parseLoginTicket } from '@/lib/loginTicket';

describe('parseLoginTicket', () => {
  it('reads the ticket the master put in the URL fragment', () => {
    expect(parseLoginTicket('#loginTicket=q3dKx0m7uZ1pYb2l9sVwQeR5tN8aHc4F6gJ_iLoPzXk')).toBe(
      'q3dKx0m7uZ1pYb2l9sVwQeR5tN8aHc4F6gJ_iLoPzXk',
    );
  });

  it('decodes percent-escaped characters', () => {
    expect(parseLoginTicket('#loginTicket=a%2Bb%2Fc%3D')).toBe('a+b/c=');
  });

  it('finds the ticket among other fragment parameters', () => {
    expect(parseLoginTicket('#lang=ru&loginTicket=abc&x=1')).toBe('abc');
  });

  it('ignores a parameter that merely ends in loginTicket', () => {
    expect(parseLoginTicket('#notloginTicket=abc')).toBe('');
  });

  it('returns nothing for an ordinary login page URL', () => {
    expect(parseLoginTicket('')).toBe('');
    expect(parseLoginTicket('#')).toBe('');
    expect(parseLoginTicket('#loginTicket=')).toBe('');
  });
});
