// src/AppShell.tsx
import { useEffect, useState, type ReactNode } from 'react';
import { SignIn } from './SignIn';
import { auth } from './auth';

export function AuthGate({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => auth.getToken());

  // Listen to storage changes (multi-tab logout)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'token') setToken(auth.getToken());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (!token) return <SignIn />;
  return <>{children}</>;
}

export function LogoutButton() {
  return (
    <button
      onClick={() => {
        auth.clear();
        // Simple reload to drop WS connection and re-render SignIn
        window.location.reload();
      }}
      style={{ marginLeft: 12 }}
    >
      Logout
    </button>
  );
}
