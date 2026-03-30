import { Task } from '../../domain/entities/Task';
import { InMemoryTaskRepository } from '../../infrastructure/repositories/InMemoryTaskRepository';

// VIOLATION #1: injects concrete InMemoryTaskRepository instead of ITaskRepository
export class CreateTaskUseCase {
  constructor(private readonly taskRepository: InMemoryTaskRepository) {}

  async execute(title: string, description: string, categoryId: string): Promise<Task> {
    const task = new Task(crypto.randomUUID(), title, description, false, categoryId, new Date());
    return this.taskRepository.save(task);
  }
}
