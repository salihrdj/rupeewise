import CryptoJS from 'crypto-js';

const KEY_NAME = 'spend_storage_key';

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

  // Always store key in localStorage for both n8n and offline modes.
  // This ensures offline cache persists and prevents key loss when tabs are closed.
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

function isJsonString(str) {
  if (!str) return false;
  const trimmed = str.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }
  return false;
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
 * @returns {string|null} The decrypted plaintext string or null if decryption/validation fails.
 */
export function decryptText(ciphertext) {
  if (!ciphertext) return '';
  const key = getEncryptionKey();
  if (!key) return ciphertext;
  
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    
    if (decrypted && isJsonString(decrypted)) {
      return decrypted;
    }
  } catch (e) {
    // Decryption failed or threw an error
  }

  // Fallback check: is the ciphertext itself already valid JSON? (legacy plaintext data)
  if (isJsonString(ciphertext)) {
    return ciphertext;
  }

  // If we reach here, the data is encrypted with a different/lost key or corrupted.
  // Return null instead of ciphertext to avoid JSON.parse syntax errors.
  return null;
}
