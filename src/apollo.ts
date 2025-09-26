import { ApolloClient, HttpLink, InMemoryCache, split } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient as createWSClient } from 'graphql-ws';

import { auth } from './auth';

// .env for vite (examples):
// VITE_API_URL=http://localhost:3000/graphql
// VITE_WS_URL=ws://localhost:3000/graphql
const httpUri = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/graphql';
const wsUri =
  import.meta.env.VITE_WS_URL ??
  httpUri.replace(/^http/i, httpUri.startsWith('https') ? 'wss' : 'ws');

// simple token store
export const authToken = {
  get: () => localStorage.getItem('token') || '',
  set: (t: string) => localStorage.setItem('token', t),
};

// read token from #token=... once on load
if (location.hash.startsWith('#token=')) {
  const t = location.hash.replace('#token=', '');
  authToken.set(t);
  history.replaceState(null, '', location.pathname + location.search);
}

//const httpLink = new HttpLink({ uri: httpUri });

const barerToken = authToken.get() ? `Bearer ${authToken.get()}` : '';
console.log('Using auth token:', barerToken);

// Add auth to HTTP requests
const httpLink = new HttpLink({
  uri: httpUri,
  headers: {
    authorization: barerToken,
  },
});

const authLink = setContext((_, { headers }) => {
  const token = auth.getToken();
  return {
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
});

const wsLink = new GraphQLWsLink(
  createWSClient({
    url: wsUri,
    lazy: true,
    retryAttempts: 5,
    connectionParams: () => {
      const token = auth.getToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    },
  }),
);

const splitLink = split(
  ({ query }) => {
    const def = getMainDefinition(query);
    return def.kind === 'OperationDefinition' && def.operation === 'subscription';
  },
  wsLink,
  authLink.concat(httpLink),
);

// Route subscriptions over WS, everything else over HTTP

// const link = split(
// ({ query }) => {
// const def = getMainDefinition(query);
// return def.kind === 'OperationDefinition' && def.operation === 'subscription';
// },
// wsLink,
// httpLink,
// );

export const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({
    typePolicies: {
      Task: { keyFields: ['id'] },
      Query: {
        fields: {
          // Keep it simple: replace with incoming when queries run
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
