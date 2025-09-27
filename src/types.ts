// types.ts
export type TaskGQL = {
  __typename: 'Task';
  id: string;          // non-null
  title: string;       // non-null
  completed: boolean;  // non-null
  createdAt?: number;  // timestamp in ms, optional
  updatedAt?: number;  // timestamp in ms, optional
  userId?: string;     // if you expose it

};

export type UserGQL = {
  __typename?: 'User';
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
};
