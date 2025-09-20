import {
  ApolloProvider,
  gql,
  useMutation,
  useQuery,
  useSubscription,
  type Reference,
} from '@apollo/client';

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

  // helper
  const asArray = (v: Reference | ReadonlyArray<Reference> | undefined) =>
    (Array.isArray(v) ? v : v ? [v] : []) as ReadonlyArray<Reference>;

  const [createTask, mCreate] = useMutation<CreateTaskData, CreateTaskVars>(CREATE, {
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
          tasks(
            existingIn: Reference | ReadonlyArray<Reference> | undefined,
            { readField, toReference },
          ): ReadonlyArray<Reference> {
            const existing = asArray(existingIn);

            const newRef = toReference({ __typename: 'Task', id: created.id }) as
              | Reference
              | undefined;
            if (!newRef) return existing;
            if (existing.some((r) => readField('id', r) === created.id)) return existing;

            return [newRef, ...existing];
          },
        },
      });
    },
  });

  const [delTask, mDelete] = useMutation<DeleteTaskData, DeleteTaskVars>(DELETE, {
    update(cache, { data }) {
      const deleted = data?.deleteTask;
      if (!deleted) return;
      cache.modify({
        fields: {
          tasks(
            existingIn: Reference | ReadonlyArray<Reference> | undefined,
            { readField },
          ): ReadonlyArray<Reference> {
            const existing = asArray(existingIn);
            return existing.filter((r) => readField('id', r) !== deleted.id);
          },
        },
      });
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
          tasks(
            existingIn: Reference | ReadonlyArray<Reference> | undefined,
            { readField, toReference },
          ): ReadonlyArray<Reference> {
            const existing = asArray(existingIn);
            const ref = toReference({ __typename: 'Task', id: t.id }) as Reference | undefined;
            if (!ref) return existing;
            if (existing.some((r) => readField('id', r) === t.id)) return existing;
            return [ref, ...existing];
          },
        },
      });
    },
  });

  useSubscription(TASK_UPDATED, {
    onData: ({ client, data }) => {
      const t = data.data?.taskUpdated;
      if (!t) return;

      client.cache.writeFragment({
        id: client.cache.identify({ __typename: 'Task', id: t.id }),
        fragment: gql`
          fragment TaskUpdatedFields on Task {
            id
            title
            completed
          }
        `,
        data: t,
      });
    },
  });

  useSubscription(TASK_DELETED, {
    onData: ({ client, data }) => {
      const t = data.data?.taskDeleted;
      if (!t) return;

      client.cache.modify({
        fields: {
          tasks(
            existingIn: Reference | ReadonlyArray<Reference> | undefined,
            { readField },
          ): ReadonlyArray<Reference> {
            const existing = asArray(existingIn);
            return existing.filter((r) => readField('id', r) !== t.id);
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
