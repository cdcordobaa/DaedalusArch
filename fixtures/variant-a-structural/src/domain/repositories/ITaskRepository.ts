import { Task } from '../entities/Task';

export interface ITaskRepository {
  findById(id: string): Promise<Task | null>;
  findAll(): Promise<Task[]>;
  save(task: Task): Promise<Task>;
  delete(id: string): Promise<void>;
}
