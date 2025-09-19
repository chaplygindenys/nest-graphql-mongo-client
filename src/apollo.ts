import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';

const fallback = 'http://localhost:3000/graphql'; // local fallback
export const API_URL = (import.meta.env.VITE_API_URL as string) || fallback;
console.log('[client] VITE_API_URL =', API_URL);

export const client = new ApolloClient({
  link: new HttpLink({
    uri: API_URL,
    // fetchOptions: { mode: 'cors' }, // not required but OK
  }),
  cache: new InMemoryCache(),
});
