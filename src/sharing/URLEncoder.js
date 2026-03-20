/**
 * Shareable worlds via URL.
 * Text compressed with LZ-String and stored in URL hash fragment.
 * For long texts, falls back to IndexedDB with hash-based key.
 */
import LZString from 'lz-string';
import { murmurhash3 } from '../utils/hash.js';

const MAX_URL_LENGTH = 4000;

export class URLEncoder {
  /** Encode text into a shareable URL */
  static encode(text) {
    const compressed = LZString.compressToEncodedURIComponent(text);
    const url = `${window.location.origin}${window.location.pathname}#t=${compressed}`;

    if (url.length > MAX_URL_LENGTH) {
      // Store in IndexedDB and use hash reference
      const hash = murmurhash3(text).toString(36);
      URLEncoder._storeLocally(hash, text);
      return `${window.location.origin}${window.location.pathname}#h=${hash}`;
    }

    return url;
  }

  /** Decode text from current URL hash */
  static async decode() {
    const hash = window.location.hash;
    if (!hash || hash.length < 3) return null;

    if (hash.startsWith('#t=')) {
      const compressed = hash.slice(3);
      const result = LZString.decompressFromEncodedURIComponent(compressed);
      if (result === null) {
        console.warn('URL decode returned null (corrupt data)');
      }
      return result;
    }

    if (hash.startsWith('#h=')) {
      const key = hash.slice(3);
      return URLEncoder._retrieveLocally(key);
    }

    return null;
  }

  static _storeLocally(key, text) {
    try {
      const req = indexedDB.open('synthengine-share', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('texts', { keyPath: 'key' });
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('texts', 'readwrite');
        tx.objectStore('texts').put({ key, text, createdAt: Date.now() });
      };
    } catch (e) {
      console.warn('IndexedDB store failed:', e);
    }
  }

  static _retrieveLocally(key) {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open('synthengine-share', 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore('texts', { keyPath: 'key' });
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('texts', 'readonly');
          const getReq = tx.objectStore('texts').get(key);
          getReq.onsuccess = () => resolve(getReq.result?.text || null);
          getReq.onerror = () => resolve(null);
        };
        req.onerror = () => resolve(null);
      } catch (e) {
        console.warn('IndexedDB retrieve failed:', e);
        resolve(null);
      }
    });
  }
}
