import { gql, useMutation, useQuery, useSubscription, type Reference } from '@apollo/client';

import { useState } from 'react';
import type { TaskGQL } from './types';

// add this import
import { useApolloClient } from '@apollo/client';

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

const UPDATE = gql`
  mutation UpdateTask($id: ID!, $title: String, $completed: Boolean) {
    updateTask(input: { id: $id, title: $title, completed: $completed }) {
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

type UpdateTaskData = { updateTask: TaskGQL };
type UpdateTaskVars = { id: string; title?: string | null; completed?: boolean | null };

type DeleteTaskData = { deleteTask: Pick<TaskGQL, 'id' | '__typename'> };
type DeleteTaskVars = { id: string };

function Tasks() {
  // Fetches the list of tasks from the server using Apollo useQuery hook
  const { data, loading, error } = useQuery<TasksQuery, TasksVars>(TASKS);

  const apollo = useApolloClient();

  // Helper to ensure the value is always an array of Reference
  const asArray = (v: Reference | ReadonlyArray<Reference> | undefined) =>
    (Array.isArray(v) ? v : v ? [v] : []) as ReadonlyArray<Reference>;

  // useMutation for creating a new task
  // - optimisticResponse: immediately adds a temporary task to the UI for responsiveness
  // - update: after server responds, updates Apollo cache to include the new task
  const [createTask, mCreate] = useMutation<CreateTaskData, CreateTaskVars>(CREATE, {
    optimisticResponse: (vars) => ({
      // This temporary response is shown in the UI before the server responds
      createTask: {
        __typename: 'Task',
        id: `temp:${crypto.randomUUID()}`,
        title: vars.t,
        completed: false,
      },
    }),
    update(cache, { data }) {
      // This callback is called after the mutation completes
      const created = data?.createTask;
      if (!created) return;

      // Add the new task to the Apollo cache so the UI updates
      cache.modify({
        fields: {
          tasks(
            existingIn: Reference | ReadonlyArray<Reference> | undefined,
            { readField, toReference },
          ): ReadonlyArray<Reference> {
            const existing = asArray(existingIn);
            // Create a reference to the new task
            const newRef = toReference({ __typename: 'Task', id: created.id }) as
              | Reference
              | undefined;
            if (!newRef) return existing;
            // Avoid duplicates
            if (existing.some((r) => readField('id', r) === created.id)) return existing;
            // Add new task to the beginning of the list
            return [newRef, ...existing];
          },
        },
      });
    },
  });

  // useMutation for updating a task
  // - optimisticResponse: immediately updates the task in the UI for responsiveness
  // - update: after server responds, updates Apollo cache with the new task data
  const [updateTask, mUpdate] = useMutation<UpdateTaskData, UpdateTaskVars>(UPDATE, {
    optimisticResponse: (vars) => {
      const cacheId = apollo.cache.identify({ __typename: 'Task', id: vars.id });

      const prevTitle =
        apollo.readFragment<{ title: string }>({
          id: cacheId,
          fragment: gql`
            fragment _T on Task {
              title
            }
          `,
        })?.title ?? '';

      const prevCompleted =
        apollo.readFragment<{ completed: boolean }>({
          id: cacheId,
          fragment: gql`
            fragment _T on Task {
              completed
            }
          `,
        })?.completed ?? false;

      return {
        updateTask: {
          __typename: 'Task',
          id: vars.id,
          title: vars.title ?? prevTitle,
          completed: vars.completed ?? prevCompleted,
        },
      };
    },

    update(cache, { data }) {
      const t = data?.updateTask;
      if (!t) return;
      cache.writeFragment({
        id: cache.identify({ __typename: 'Task', id: t.id }),
        fragment: gql`
          fragment UpdatedTask on Task {
            id
            title
            completed
          }
        `,
        data: t,
      });
    },
  });

  /**
  const [updateTask, mUpdate] = useMutation(UPDATE, {
    optimisticResponse: (vars) => ({
      updateTask: {
        __typename: 'Task',
        id: vars.id, // <-- keep the same id
        title: vars.title ?? undefined, // or read from cache if needed
        completed: vars.completed ?? undefined,
      },
    }),
  });
  */

  // useMutation for deleting a task
  // - update: after server responds, removes the task from Apollo cache
  const [delTask, mDelete] = useMutation<DeleteTaskData, DeleteTaskVars>(DELETE, {
    update(cache, { data }) {
      // This callback is called after the mutation completes
      const deleted = data?.deleteTask;
      if (!deleted) return;
      // Remove the deleted task from the Apollo cache
      cache.modify({
        fields: {
          tasks(
            existingIn: Reference | ReadonlyArray<Reference> | undefined,
            { readField },
          ): ReadonlyArray<Reference> {
            const existing = asArray(existingIn);
            // Filter out the deleted task by id
            return existing.filter((r) => readField('id', r) !== deleted.id);
          },
        },
      });
      // Evict the deleted task from the cache and run garbage collection
      cache.evict({ id: cache.identify(deleted) });
      cache.gc();
    },
  });

  // --- Subscriptions keep everyone in sync ---

  const adddTAskSubData = useSubscription(TASK_ADDED, {
    onSubscriptionData: ({ subscriptionData }) => {
      console.log('[CLIENT] TASK_ADDED data:', subscriptionData?.data);
    },
    onError: (e) => console.error('[CLIENT] TASK_ADDED error:', e),

    onData: ({ client, data }) => {
      console.log('Subscription data _add:', data);

      // This callback is called when a new task is added (via subscription)
      const t = data.data?.taskAdded;
      if (!t) return;

      // Add the new task to the Apollo cache
      client.cache.modify({
        fields: {
          tasks(
            existingIn: Reference | ReadonlyArray<Reference> | undefined,
            { readField, toReference },
          ): ReadonlyArray<Reference> {
            const existing = asArray(existingIn);
            const ref = toReference({ __typename: 'Task', id: t.id }) as Reference | undefined;
            if (!ref) return existing;
            // Avoid duplicates
            if (existing.some((r) => readField('id', r) === t.id)) return existing;
            // Add new task to the beginning of the list
            return [ref, ...existing];
          },
        },
      });
    },
  });

  console.log('[CLIENT] TASK_ADDED hook mounted', adddTAskSubData);

  // Listen for task updates from other clients
  const updateTaskSubData = useSubscription(TASK_UPDATED, {
    onSubscriptionData: ({ subscriptionData }) => {
      console.log('[CLIENT] TASK_UPDATED data:', subscriptionData?.data);
    },
    onError: (e) => console.error('[CLIENT] TASK_UPDATED error:', e),

    onData: ({ client, data }) => {
      console.log('Subscription data _update:', data);
      // This callback is called when a task is updated (via subscription)
      const t = data.data?.taskUpdated;
      if (!t) return;

      // Write the updated task data to the Apollo cache
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

  console.log('[CLIENT] TASK_UPDATED hook mounted', updateTaskSubData);

  // Listen for task deletions from other clients
  const deleteTaskSubData = useSubscription(TASK_DELETED, {
    onSubscriptionData: ({ subscriptionData }) => {
      console.log('[CLIENT] TASK_DELETE data:', subscriptionData?.data);
    },
    onError: (e) => console.error('[CLIENT] TASK_DELETE error:', e),

    onData: ({ client, data }) => {
      console.log('Subscription data _delete:', data);
      // This callback is called when a task is deleted (via subscription)
      const t = data.data?.taskDeleted;
      if (!t) return;

      // Remove the deleted task from the Apollo cache
      client.cache.modify({
        fields: {
          tasks(
            existingIn: Reference | ReadonlyArray<Reference> | undefined,
            { readField },
          ): ReadonlyArray<Reference> {
            const existing = asArray(existingIn);
            // Filter out the deleted task by id
            return existing.filter((r) => readField('id', r) !== t.id);
          },
        },
      });
      // Evict the deleted task from the cache and run garbage collection
      client.cache.evict({ id: client.cache.identify(t) });
      client.cache.gc();
    },
  });
  console.log('[CLIENT] TASK_DELETE hook mounted', deleteTaskSubData);

  // ------------------------------------------

  // State for the new task title input
  const [title, setTitle] = useState('');

  // Show loading or error states
  if (loading) return <p>Loading…</p>;
  if (error) return <pre style={{ color: 'red' }}>Query error: {error.message}</pre>;

  return (
    <div style={{ maxWidth: 560, margin: '40px auto', fontFamily: 'system-ui' }}>
      <h1>Nest + GraphQL + Mongo (Demo)</h1>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={title}
          // Update the title state as the user types
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          style={{ flex: 1, padding: 8 }}
        />
        <button
          disabled={!title || mCreate.loading}
          // When clicked, create a new task and clear the input
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
              // When clicked, delete the task (with optimistic UI)
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

            <button
              aria-label="Toggle complete"
              // When clicked, toggle the completed state of the task
              onClick={() =>
                updateTask({
                  variables: { id: t.id, completed: !t.completed }, // <-- pass id!
                }).catch((e) => console.error('updateTask error:', e))
              }
              disabled={mUpdate.loading}
              title="Toggle complete"
            >
              {t.completed ? '❌' : '✅'}
            </button>

            <button
              aria-label="Rename"
              // When clicked, prompt for a new title and update the task if changed
              onClick={() => {
                const newTitle = prompt('New title', t.title);
                if (newTitle && newTitle !== t.title) {
                  updateTask({
                    variables: { id: t.id, title: newTitle },
                  }).catch((e) => console.error('updateTask (title) error:', e));
                }
              }}
              disabled={mUpdate.loading}
              title="Rename"
            >
              ✏️
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export { Tasks };
