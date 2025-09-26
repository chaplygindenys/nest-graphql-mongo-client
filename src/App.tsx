// src/App.tsx (only the shell bits shown; keep your Tasks component code)
import { ApolloProvider } from '@apollo/client';
import { client } from './apollo';
import { AuthGate, LogoutButton } from './AppShell';
import { Tasks } from './Tasks';

export default function App() {
  return (
    <ApolloProvider client={client}>
      <AuthGate>
        <div style={{ maxWidth: 560, margin: '40px auto', fontFamily: 'system-ui' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1>Nest + GraphQL + Mongo (Demo)</h1>
            <LogoutButton />
          </div>
          <Tasks />
        </div>
      </AuthGate>
    </ApolloProvider>
  );
}
