// js/api.js
// Thin wrapper around fetch() for talking to the backend API.
// Centralizes the base URL, auth header injection, and JSON handling
// so other scripts don't repeat boilerplate or accidentally trust
// client-side values for things the server should decide.

const API_BASE_URL = (() => {
  // Allows overriding via a query param or meta tag during local dev
  // without touching code, e.g. <meta name="api-base" content="...">.
  const meta = document.querySelector('meta[name="api-base"]');
  if (meta && meta.content) return meta.content;
  return 'http://localhost:5000/api';
})();

const TOKEN_KEY = 'wallet_token';
const USER_KEY = 'wallet_user';

const Auth = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch {
      return null;
    }
  },
  setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  isLoggedIn() {
    return !!this.getToken();
  },
  isAdmin() {
    const user = this.getUser();
    return !!user && user.role === 'admin';
  },
};

/**
 * Core request helper. Always sends JSON, always attaches the bearer
 * token when present, and normalizes error handling so callers get a
 * consistent { success, message, ...data } shape or a thrown ApiError.
 */
class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = Auth.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new ApiError(
      'Could not reach the server. Check your connection and try again.',
      0,
      null
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    // 401 means the token is invalid/expired - clear local session so the
    // UI doesn't keep pretending the user is logged in.
    if (response.status === 401) {
      Auth.clear();
    }
    throw new ApiError(
      data.message || `Request failed with status ${response.status}.`,
      response.status,
      data
    );
  }

  return data;
}

const Api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
};
