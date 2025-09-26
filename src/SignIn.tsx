// src/SignIn.tsx
export function SignIn() {
  const authUrl = import.meta.env.VITE_AUTH_URL as string;
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'system-ui',
        background: '#fff',
      }}
    >
      <button
        onClick={() => (window.location.href = authUrl)}
        style={{
          fontSize: 16,
          padding: '12px 18px',
          borderRadius: 8,
          border: '1px solid #ddd',
          background: '#fff',
          cursor: 'pointer',
        }}
      >
        Sign in with Google
      </button>
    </div>
  );
}
