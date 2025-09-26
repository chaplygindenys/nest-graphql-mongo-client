// src/auth.ts
export const auth = {
  getToken(): string | null {
    return localStorage.getItem('token');
  },
  setToken(t: string) {
    localStorage.setItem('token', t);
  },
  clear() {
    localStorage.removeItem('token');
  },
};

// Read token from URL fragment after /auth/google/callback redirect
export function absorbTokenFromHash() {
  // supports: #token=...  or  ?token=...
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const qs = new URLSearchParams(window.location.search);
  const token = hash.get('token') || qs.get('token');
  if (token) {
    auth.setToken(token);
    // clean the URL
    const url = window.location.pathname + window.location.search;
    history.replaceState(null, '', url);
  }
}
