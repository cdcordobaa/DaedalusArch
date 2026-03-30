import { Task } from '../entities/Task';

// VIOLATION: fat interface (9 methods)
export interface ITaskRepository {
  findById(id: string): Promise<Task | null>;
  findAll(): Promise<Task[]>;
  findByCategory(categoryId: string): Promise<Task[]>;
  findCompleted(): Promise<Task[]>;
  findPending(): Promise<Task[]>;
  findByPriority(priority: string): Promise<Task[]>;
  save(task: Task): Promise<Task>;
  update(task: Task): Promise<Task>;
  delete(id: string): Promise<void>;
}
