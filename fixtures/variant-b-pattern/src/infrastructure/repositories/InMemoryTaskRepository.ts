import { Task } from '../../domain/entities/Task';
// VIOLATION #3: does NOT implement ITaskRepository — breaks repository pattern
export class InMemoryTaskRepository {
  private readonly store = new Map<string, Task>();

  async findById(id: string): Promise<Task | null> {
    return this.store.get(id) ?? null;
  }

  async findAll(): Promise<Task[]> {
    return [...this.store.values()];
  }

  async findByCategory(categoryId: string): Promise<Task[]> {
    return [...this.store.values()].filter((t) => t.categoryId === categoryId);
  }

  async findCompleted(): Promise<Task[]> {
    return [...this.store.values()].filter((t) => t.completed);
  }

  async findPending(): Promise<Task[]> {
    return [...this.store.values()].filter((t) => !t.completed);
  }

  async save(task: Task): Promise<Task> {
    this.store.set(task.id, task);
    return task;
  }

  async update(task: Task): Promise<Task> {
    this.store.set(task.id, task);
    return task;
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}
