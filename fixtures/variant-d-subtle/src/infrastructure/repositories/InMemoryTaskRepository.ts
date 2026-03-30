import { Task } from '../../domain/entities/Task';
import { ITaskRepository } from '../../domain/repositories/ITaskRepository';

export class InMemoryTaskRepository implements ITaskRepository {
  private readonly store = new Map<string, Task>();

  async findById(id: string): Promise<Task | null> {
    return this.store.get(id) ?? null;
  }

  async findAll(): Promise<Task[]> {
    return [...this.store.values()];
  }

  async save(task: Task): Promise<Task> {
    this.store.set(task.id, task);
    return task;
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}
