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

// Read token from URL after /auth/... redirect
export function absorbTokenFromHash() {
  const url = new URL(window.location.href);

  // support both hash and query
  const hashToken = url.hash.startsWith('#token=') ? url.hash.slice('#token='.length) : null;
  const queryToken = url.searchParams.get('token');
  const token = hashToken ?? queryToken;

  if (token) {
    auth.setToken(token);

    // clean URL: remove hash & ?token and also any accidental "/undefined"
    url.hash = '';
    url.searchParams.delete('token');
    url.pathname = url.pathname.replace(/\/undefined\/?$/, '');

    history.replaceState(null, '', url.toString());
  }
}
