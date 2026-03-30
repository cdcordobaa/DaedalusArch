import { Task } from '../../domain/entities/Task';
import { InMemoryTaskRepository } from '../../infrastructure/repositories/InMemoryTaskRepository';

// VIOLATION: injects concrete repository
export class CreateTaskUseCase {
  constructor(private readonly taskRepository: InMemoryTaskRepository) {}

  async execute(title: string, description: string, categoryId: string): Promise<Task> {
    const task = new Task(crypto.randomUUID(), title, description, false, categoryId, new Date());
    return this.taskRepository.save(task);
  }
}
