import { ApolloClient, HttpLink, InMemoryCache, split } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient as createWSClient } from 'graphql-ws';
import { absorbTokenFromHash, auth } from './auth';

// Vite envs
const httpUri = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/graphql';
const wsUri =
  import.meta.env.VITE_WS_URL ??
  httpUri.replace(/^http/i, httpUri.startsWith('https') ? 'wss' : 'ws');

// Simple token store
export const authToken = {
  get: () => localStorage.getItem('token') || '',
  set: (t: string) => localStorage.setItem('token', t),
};

// Support #token=... on first load
if (location.hash.startsWith('#token=')) {
  const t = location.hash.slice('#token='.length);
  authToken.set(t);
  history.replaceState(null, '', location.pathname + location.search);
}

// --- HTTP link with auth (lower-case header) ---
const httpLink = new HttpLink({ uri: httpUri });

const authLink = setContext((_, { headers }) => {
  absorbTokenFromHash();
  const token = auth.getToken(); // or authToken.get()
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}), // << lower-case
    },
  };
});

// --- WS link with auth (lower-case connection param) ---
const wsLink = new GraphQLWsLink(
  createWSClient({
    url: wsUri,
    lazy: true,
    retryAttempts: 5,
    connectionParams: () => {
      absorbTokenFromHash();
      const token = auth.getToken(); // or authToken.get()
      return token ? { authorization: `Bearer ${token}` } : {}; // << lower-case
    },
  }),
);

// Split: subscriptions -> WS, others -> HTTP
const splitLink = split(
  ({ query }) => {
    const def = getMainDefinition(query);
    return def.kind === 'OperationDefinition' && def.operation === 'subscription';
  },
  wsLink,
  authLink.concat(httpLink),
);

export const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({
    typePolicies: {
      Task: { keyFields: ['id'] },
      Query: {
        fields: {
          tasks: {
            merge(_existing, incoming) {
              return incoming;
            },
          },
        },
      },
    },
  }),
});
