import { TodoStore } from '../infrastructure/todo-store';

export function makeStore(): TodoStore {
  return new TodoStore();
}
