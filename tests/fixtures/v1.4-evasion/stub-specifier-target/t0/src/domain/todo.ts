import { TodoStore } from '../infrastructure/todo-store';

export interface Todo {
  readonly id: string;
}
export const todoStore = new TodoStore();
