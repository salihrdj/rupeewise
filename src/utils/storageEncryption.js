import CryptoJS from 'crypto-js';

const KEY_NAME = 'spend_storage_key';
const N8N_MODE_KEY = 'spend_n8n_mode';

function generateRandomKey() {
  const arr = new Uint8Array(32);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(arr);
  } else {
    // Fallback in case of non-browser execution (e.g. testing environments)
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getEncryptionKey() {
  if (typeof window === 'undefined') return null;

  const isN8nMode = localStorage.getItem(N8N_MODE_KEY) === 'true';

  if (isN8nMode) {
    // n8n mode: keep key in sessionStorage (wiped when tab closes)
    let key = sessionStorage.getItem(KEY_NAME);
    if (!key) {
      // Migrate key if it existed in offline mode
      const legacyKey = localStorage.getItem(KEY_NAME);
      if (legacyKey) {
        key = legacyKey;
        sessionStorage.setItem(KEY_NAME, key);
        localStorage.removeItem(KEY_NAME);
      } else {
        key = generateRandomKey();
        sessionStorage.setItem(KEY_NAME, key);
      }
    }
    return key;
  } else {
    // Offline mode: keep key in localStorage so data persists across browser restarts
    let key = localStorage.getItem(KEY_NAME);
    if (!key) {
      // Migrate key if it existed in sessionStorage
      const legacyKey = sessionStorage.getItem(KEY_NAME);
      if (legacyKey) {
        key = legacyKey;
        localStorage.setItem(KEY_NAME, key);
        sessionStorage.removeItem(KEY_NAME);
      } else {
        key = generateRandomKey();
        localStorage.setItem(KEY_NAME, key);
      }
    }
    return key;
  }
}

/**
 * Encrypts a string synchronously using CryptoJS AES.
 * @param {string} text - The plaintext string to encrypt.
 * @returns {string} The AES ciphertext.
 */
export function encryptText(text) {
  if (!text) return '';
  const key = getEncryptionKey();
  if (!key) return text;
  try {
    return CryptoJS.AES.encrypt(text, key).toString();
  } catch (e) {
    console.error('Encryption failed:', e);
    return text;
  }
}

/**
 * Decrypts a string synchronously using CryptoJS AES.
 * Supports fallback to plaintext if decryption fails (useful for migration).
 * @param {string} ciphertext - The AES ciphertext to decrypt.
 * @returns {string} The decrypted plaintext string.
 */
export function decryptText(ciphertext) {
  if (!ciphertext) return '';
  const key = getEncryptionKey();
  if (!key) return ciphertext;
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) {
      // Fallback: If decryption output is empty, it might be stored as plaintext (legacy data)
      return ciphertext;
    }
    return decrypted;
  } catch (e) {
    // Fallback to original ciphertext if it fails or throws (legacy data)
    return ciphertext;
  }
}
