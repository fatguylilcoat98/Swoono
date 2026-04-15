/**
 * Client ID generation and management for Swoono.
 * Generates a unique identifier for each client session.
 */

let _clientId: string | null = null;
let _isPrivateBrowsing = false;

function generateClientId(): string {
  return Math.random().toString(36).slice(2, 10) +
         Math.random().toString(36).slice(2, 10);
}

function detectPrivateBrowsing(): boolean {
  try {
    // Test if localStorage is available and persistent
    const testKey = '__swoono_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return false;
  } catch {
    return true;
  }
}

function readClientId(): string {
  if (_clientId) return _clientId;

  const KEY = "swoono:clientId";
  _isPrivateBrowsing = detectPrivateBrowsing();

  if (_isPrivateBrowsing) {
    console.warn("[swoono] Private browsing detected - using session storage");
    try {
      let id = sessionStorage.getItem(KEY);
      if (!id) {
        id = generateClientId();
        sessionStorage.setItem(KEY, id);
      }
      _clientId = id;
      return id;
    } catch {
      // Complete fallback to memory-only
      console.warn("[swoono] Storage unavailable - using memory-only client ID");
      _clientId = generateClientId();
      return _clientId;
    }
  }

  // Normal mode - use localStorage
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = generateClientId();
      localStorage.setItem(KEY, id);
    }
    _clientId = id;
    return id;
  } catch {
    // Fallback to sessionStorage
    try {
      let id = sessionStorage.getItem(KEY);
      if (!id) {
        id = generateClientId();
        sessionStorage.setItem(KEY, id);
      }
      _clientId = id;
      return id;
    } catch {
      // Ultimate fallback
      _clientId = generateClientId();
      return _clientId;
    }
  }
}

export const CLIENT_ID = readClientId();

export function isPrivateBrowsing(): boolean {
  return _isPrivateBrowsing;
}

export function getClientId(): string {
  return CLIENT_ID;
}
