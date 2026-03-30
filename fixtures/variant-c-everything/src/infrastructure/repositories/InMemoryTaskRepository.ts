import { Task } from '../../domain/entities/Task';
import { CircularB } from './CircularB';

// Does NOT implement ITaskRepository (repository pattern violation)
export class InMemoryTaskRepository {
  private readonly store = new Map<string, Task>();
  private readonly helper = new CircularB();

  async findById(id: string): Promise<Task | null> {
    return this.store.get(id) ?? null;
  }

  async findAll(): Promise<Task[]> {
    return [...this.store.values()];
  }

  async findByCategory(categoryId: string): Promise<Task[]> {
    return [...this.store.values()].filter(t => t.categoryId === categoryId);
  }

  async findCompleted(): Promise<Task[]> {
    return [...this.store.values()].filter(t => t.completed);
  }

  async findPending(): Promise<Task[]> {
    return [...this.store.values()].filter(t => !t.completed);
  }

  async findByPriority(_priority: string): Promise<Task[]> {
    return [...this.store.values()];
  }

  async save(task: Task): Promise<Task> {
    this.store.set(task.id, task);
    return task;
  }

  async update(task: Task): Promise<Task> {
    return this.save(task);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}
