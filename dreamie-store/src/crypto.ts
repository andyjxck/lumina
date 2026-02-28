// AES-GCM encryption helpers for chat messages.
// Key is derived from sorted(userA_id + userB_id) using PBKDF2.
// The "password" is the concatenation of the two UUIDs in sorted order.
// This means both parties and admin (who knows both IDs) can decrypt.

const APP_SALT = 'ac-villager-trade-v1';

async function deriveKey(userAId: string, userBId: string): Promise<CryptoKey> {
  const ids = [userAId, userBId].sort().join('');
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(ids), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(APP_SALT), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptMessage(plaintext: string, userAId: string, userBId: string): Promise<{ content_enc: string; iv: string }> {
  const key = await deriveKey(userAId, userBId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  const toB64 = (buf: ArrayBuffer | Uint8Array) => {
    const bytes = new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer);
    let s = '';
    bytes.forEach(b => { s += String.fromCharCode(b); });
    return btoa(s);
  };
  return { content_enc: toB64(ciphertext), iv: toB64(iv) };
}

export async function decryptMessage(content_enc: string, iv: string, userAId: string, userBId: string): Promise<string> {
  const key = await deriveKey(userAId, userBId);
  const fromB64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(iv) }, key, fromB64(content_enc)
    );
    return new TextDecoder().decode(plain);
  } catch {
    return '[encrypted]';
  }
}
