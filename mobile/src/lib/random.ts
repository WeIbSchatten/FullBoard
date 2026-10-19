import * as Crypto from 'expo-crypto';

import type { RandomSource } from './inboundDraft';

const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

function toBase64(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return globalThis.btoa(s);
}

export const deviceRandom: RandomSource = {
  hex: (n) => toHex(Crypto.getRandomBytes(n)),
  base64: (n) => toBase64(Crypto.getRandomBytes(n)),
  uuid: () => Crypto.randomUUID(),
  port: () => {
    const [hi, lo] = Crypto.getRandomBytes(2);
    return 10000 + (((hi << 8) | lo) % 50000);
  },
};
