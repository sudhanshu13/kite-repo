const TOKEN_STORAGE_KEY = 'kite_session_token';

let memoryToken: string | null = null;

export function getAuthToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    const stored = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      memoryToken = stored;
      return stored;
    }
  } catch {
    // Ignore sessionStorage errors in restricted sandboxes
  }
  return null;
}

export function setAuthToken(token: string | null) {
  memoryToken = token;
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore sessionStorage errors
  }
}

export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(init.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  });
}
