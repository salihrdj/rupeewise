// Web Crypto API wrapper for token encryption
const ALGO = { name: 'AES-GCM', length: 256 };
const IV_LENGTH = 12;
const KEY_STORAGE_KEY = 'spend_enc_key';

async function getOrCreateKey(): Promise<CryptoKey> {
  const stored = sessionStorage.getItem(KEY_STORAGE_KEY);
  if (stored) {
    try {
      return await crypto.subtle.importKey(
        'raw',
        new Uint8Array(JSON.parse(stored)),
        ALGO,
        false,
        ['encrypt', 'decrypt']
      );
    } catch {
      // Key corrupted, generate new one
      sessionStorage.removeItem(KEY_STORAGE_KEY);
    }
  }
  const key = await crypto.subtle.generateKey(ALGO, true, ['encrypt', 'decrypt']);
  const exported = await crypto.subtle.exportKey('raw', key);
  sessionStorage.setItem(KEY_STORAGE_KEY, JSON.stringify(Array.from(new Uint8Array(exported))));
  return key;
}

export async function encryptToken(token: string): Promise<string> {
  if (!token) return '';
  try {
    const key = await getOrCreateKey();
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoded = new TextEncoder().encode(token);
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
  } catch {
    return '';
  }
}

export async function decryptToken(encrypted: string): Promise<string> {
  if (!encrypted) return '';
  try {
    const key = await getOrCreateKey();
    const combined = new Uint8Array(atob(encrypted).split('').map(c => c.charCodeAt(0)));
    const iv = combined.slice(0, IV_LENGTH);
    const data = combined.slice(IV_LENGTH);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(decrypted);
  } catch {
    return '';
  }
}

export function clearTokenEncryption(): void {
  sessionStorage.removeItem(KEY_STORAGE_KEY);
}