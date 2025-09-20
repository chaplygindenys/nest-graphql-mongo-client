import { ApolloClient, HttpLink, InMemoryCache, split } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient as createWSClient } from 'graphql-ws';

// .env for vite (examples):
// VITE_API_URL=http://localhost:3000/graphql
// VITE_WS_URL=ws://localhost:3000/graphql
const httpUri = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/graphql';
const wsUri =
  import.meta.env.VITE_WS_URL ??
  httpUri.replace(/^http/i, httpUri.startsWith('https') ? 'wss' : 'ws');

const httpLink = new HttpLink({ uri: httpUri });

const wsLink = new GraphQLWsLink(
  createWSClient({
    url: wsUri,
    // connectionParams: { authToken: '…' }, // if you add auth later
  }),
);

// Route subscriptions over WS, everything else over HTTP
const link = split(
  ({ query }) => {
    const def = getMainDefinition(query);
    return def.kind === 'OperationDefinition' && def.operation === 'subscription';
  },
  wsLink,
  httpLink,
);

export const client = new ApolloClient({
  link,
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
