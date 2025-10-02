// src/apollo.ts
import { ApolloClient, HttpLink, InMemoryCache, split } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient as createWSClient } from 'graphql-ws';

import { absorbTokenFromHash, auth } from './auth';

// ------------ config & small logger ------------
const DEBUG =
  import.meta.env.MODE !== 'production' ||
  String(import.meta.env.VITE_LOGS ?? '').toLowerCase() === 'true';

const log = (...args: any[]) => DEBUG && console.log('[APOLLO]', ...args);
const warn = (...args: any[]) => DEBUG && console.warn('[APOLLO]', ...args);
const err = (...args: any[]) => DEBUG && console.error('[APOLLO]', ...args);

// .env for Vite
// VITE_API_URL=https://apps.example.com/graphql
// VITE_WS_URL=wss://apps.example.com/graphql
const httpUri = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3000/graphql';

const wsUri =
  (import.meta.env.VITE_WS_URL as string) ??
  httpUri.replace(/^http/i, httpUri.startsWith('https') ? 'wss' : 'ws');

log('HTTP URI:', httpUri);
log('WS   URI:', wsUri);

// ------------ token bootstrap ------------
absorbTokenFromHash();

// ------------ HTTP link (with auth) ------------
const httpLink = new HttpLink({ uri: httpUri });

const authLink = setContext((_, { headers }) => {
  absorbTokenFromHash(); // one more time in case hash just appeared
  const token = auth.getToken();
  if (!token) warn('no auth token for HTTP request');
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

// GraphQL & network error logging
const errorLink = onError(({ operation, graphQLErrors, networkError }) => {
  if (graphQLErrors?.length) {
    for (const e of graphQLErrors) {
      err(
        'GQL error:',
        JSON.stringify(
          {
            op: operation.operationName,
            message: e.message,
            path: e.path,
            code: e.extensions?.code,
          },
          null,
          2,
        ),
      );
    }
  }
  if (networkError) err('Network error:', networkError);
});

// ------------ WS link (with auth) ------------
const wsClient = createWSClient({
  url: wsUri,
  lazy: true,
  lazyCloseTimeout: 30_000,    // keep open for 30s after the last sub ends
  keepAlive: 15_000,           // optional: ping interval
  retryAttempts: 5,
  connectionParams: () => {
    absorbTokenFromHash();
    const token = auth.getToken();
    if (!token) warn('no auth token for WS connection');
    return token ? { authorization: `Bearer ${token}` } : {};
  },
  on: {
    connected: (_socket, payload) => log('[WS] connected', _socket, payload ?? '(no ack payload)'),
    ping: () => log('[WS] ping'),
    pong: () => log('[WS] pong'),
    closed: (event: any) => log('[WS] closed', event?.code, event?.reason),
    error: (e) => err('[WS] error', e),
  },
});

const wsLink = new GraphQLWsLink(wsClient);

// ------------ split: sub over WS, rest over HTTP ------------
const splitLink = split(
  ({ query }) => {
    const def = getMainDefinition(query);
    return def.kind === 'OperationDefinition' && def.operation === 'subscription';
  },
  wsLink,
  errorLink.concat(authLink).concat(httpLink),
);

// ------------ client ------------
export const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({
    typePolicies: {
      Task: { keyFields: ['id'] },
      Query: {
        fields: {
          tasks: {
            keyArgs: false,
            merge(_existing, incoming) {
              return incoming;
            },
          },
        },
      },
    },
  }),
});

// handy export if you want to toggle logs from outside
export const apolloDebug = { DEBUG, log, warn, err };
