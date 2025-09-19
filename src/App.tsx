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
      __typename
    }
  }
`;

const CREATE = gql`
  mutation ($t: String!) {
    createTask(input: { title: $t }) {
      id
      title
      completed
      __typename
    }
  }
`;

// delete returns the deleted Task
const DELETE = gql`
  mutation DeleteTask($id: ID!) {
    deleteTask(id: $id) {
      id
      __typename
    }
  }
`;

function Tasks() {
  const { data, loading, error } = useQuery(TASKS);
  const [createTask, mCreate] = useMutation(CREATE);
  const [delTask, mDelete] = useMutation(DELETE, {
    update(cache, { data }) {
      const deleted = data?.deleteTask;
      if (!deleted) return;

      // remove from the tasks array used by TASKS query
      cache.modify({
        fields: {
          tasks(existingRefs: any[], { readField }) {
            return existingRefs.filter((ref) => readField('id', ref) !== deleted.id);
          },
        },
      });

      // evict the entity from the normalized cache as well
      cache.evict({ id: cache.identify(deleted) });
      cache.gc();
    },
  });

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
          disabled={!title || mCreate.loading}
          onClick={async () => {
            await createTask({ variables: { t: title } });
            setTitle('');
          }}
        >
          {mCreate.loading ? 'Creating…' : 'Add'}
        </button>
      </div>

      <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
        {(data?.tasks ?? []).map((t: any) => (
          <li key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1 }}>
              {t.title} {t.completed ? '✅' : ' '}
            </span>
            <button
              aria-label="Delete task"
              onClick={() =>
                delTask({
                  variables: { id: t.id },
                  optimisticResponse: { deleteTask: { id: t.id, __typename: 'Task' } },
                }).catch((e) => console.error('deleteTask error:', e))
              }
              disabled={mDelete.loading}
              style={{ border: 'none', background: '#eee', padding: '2px 6px', cursor: 'pointer' }}
              title="Delete"
            >
              ×
            </button>
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
