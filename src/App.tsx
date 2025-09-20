import { ApolloProvider, gql, useMutation, useQuery, useSubscription } from '@apollo/client';
import { useState } from 'react';
import { client } from './apollo';
import type { TaskGQL } from './types';

const TASKS = gql`
  query Tasks {
    tasks {
      id
      title
      completed
      __typename
    }
  }
`;

const CREATE = gql`
  mutation CreateTask($t: String!) {
    createTask(input: { title: $t }) {
      id
      title
      completed
      __typename
    }
  }
`;

const DELETE = gql`
  mutation DeleteTask($id: ID!) {
    deleteTask(id: $id) {
      id
      __typename
    }
  }
`;

const TASK_ADDED = gql`
  subscription {
    taskAdded {
      id
      title
      completed
      __typename
    }
  }
`;
const TASK_UPDATED = gql`
  subscription {
    taskUpdated {
      id
      title
      completed
      __typename
    }
  }
`;
const TASK_DELETED = gql`
  subscription {
    taskDeleted {
      id
      __typename
    }
  }
`;

// Query types
type TasksQuery = { tasks: TaskGQL[] };
type TasksVars = {};

// Mutation types
type CreateTaskData = { createTask: TaskGQL };
type CreateTaskVars = { t: string };

type DeleteTaskData = { deleteTask: Pick<TaskGQL, 'id' | '__typename'> };
type DeleteTaskVars = { id: string };

function Tasks() {
  const { data, loading, error } = useQuery<TasksQuery, TasksVars>(TASKS);

  const [createTask, mCreate] = useMutation<CreateTaskData, CreateTaskVars>(CREATE, {
    // Optimistic add for snappy UX
    optimisticResponse: (vars) => ({
      createTask: {
        __typename: 'Task',
        id: `temp:${crypto.randomUUID()}`,
        title: vars.t,
        completed: false,
      },
    }),
    update(cache, { data }) {
      const created = data?.createTask;
      if (!created) return;
      cache.modify({
        fields: {
          tasks(existing: any[] = [], { readField }) {
            const exists = existing.some((ref) => readField('id', ref) === created.id);
            return exists ? existing : [created, ...existing];
          },
        },
      });
    },
  });

  const [delTask, mDelete] = useMutation<DeleteTaskData, DeleteTaskVars>(DELETE, {
    update(cache, { data }) {
      const deleted = data?.deleteTask;
      if (!deleted) return;
      // Remove from the list
      cache.modify({
        fields: {
          tasks(existingRefs: any[], { readField }) {
            return existingRefs.filter((ref) => readField('id', ref) !== deleted.id);
          },
        },
      });
      // Remove any cached queries for this item
      cache.evict({ id: cache.identify(deleted) });
      cache.gc();
    },
  });

  // --- Subscriptions keep everyone in sync ---
  useSubscription(TASK_ADDED, {
    onData: ({ client, data }) => {
      const t = data.data?.taskAdded;
      if (!t) return;
      client.cache.modify({
        fields: {
          tasks(existing: any[] = [], { readField }) {
            const exists = existing.some((ref) => readField('id', ref) === t.id);
            return exists ? existing : [t, ...existing];
          },
        },
      });
    },
  });

  useSubscription(TASK_UPDATED, {
    onData: ({ client, data }) => {
      const t = data.data?.taskUpdated;
      if (!t) return;
      client.cache.modify({
        fields: {
          tasks(existing: any[] = [], { readField }) {
            return existing.map((ref) => (readField('id', ref) === t.id ? t : ref));
          },
        },
      });
    },
  });

  useSubscription(TASK_DELETED, {
    onData: ({ client, data }) => {
      const t = data.data?.taskDeleted;
      if (!t) return;
      client.cache.modify({
        fields: {
          tasks(existing: any[] = [], { readField }) {
            return existing.filter((ref) => readField('id', ref) !== t.id);
          },
        },
      });
      client.cache.evict({ id: client.cache.identify(t) });
      client.cache.gc();
    },
  });
  // ------------------------------------------

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
          onClick={() => {
            createTask({ variables: { t: title } });
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
