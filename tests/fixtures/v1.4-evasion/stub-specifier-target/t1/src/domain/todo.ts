import { makeStore } from '../helpers/todo-access';

export interface Todo {
  readonly id: string;
}
export const todoStore = makeStore();
