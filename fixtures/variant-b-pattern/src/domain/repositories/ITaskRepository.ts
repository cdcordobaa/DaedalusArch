import { Task } from '../entities/Task';

// VIOLATION #5: Fat interface with 8 methods (interface segregation)
export interface ITaskRepository {
  findById(id: string): Promise<Task | null>;
  findAll(): Promise<Task[]>;
  findByCategory(categoryId: string): Promise<Task[]>;
  findCompleted(): Promise<Task[]>;
  findPending(): Promise<Task[]>;
  save(task: Task): Promise<Task>;
  update(task: Task): Promise<Task>;
  delete(id: string): Promise<void>;
}
