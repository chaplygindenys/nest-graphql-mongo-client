import { gql, useMutation, useQuery } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { useState } from 'react';
import { client } from './apollo';

const TASKS = gql`
  query {
    tasks {
      id
      title
      completed
    }
  }
`;
const CREATE = gql`
  mutation ($t: String!) {
    createTask(input: { title: $t }) {
      id
      title
      completed
    }
  }
`;

function Tasks() {
  const { data, loading, error, refetch } = useQuery(TASKS);
  const [createTask, m] = useMutation(CREATE);
  const [title, setTitle] = useState('');

  if (loading) return <p>Loading…</p>;
  if (error) return <pre style={{ color: 'red' }}>Query error: {error.message}</pre>;

  return (
    <div style={{ maxWidth: 560, margin: '40px auto', fontFamily: 'system-ui' }}>
      <h1>Nest + GraphQL + Mongo (Demo)</h1>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          style={{ flex: 1, padding: 8 }}
        />
        <button
          disabled={!title || m.loading}
          onClick={async () => {
            await createTask({ variables: { t: title } });
            setTitle('');
            refetch();
          }}
        >
          {m.loading ? 'Creating…' : 'Add'}
        </button>
      </div>
      <ul>
        {(data?.tasks ?? []).map((t: any) => (
          <li key={t.id}>
            {t.title} {t.completed ? '✅' : '❌'}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function App() {
  return (
    <ApolloProvider client={client}>
      <Tasks />
    </ApolloProvider>
  );
}
