// VIOLATION #3: Application layer imports concrete InMemoryTaskRepository (infra) directly
import { InMemoryTaskRepository } from '../../infrastructure/repositories/InMemoryTaskRepository';
import { Task } from '../../domain/entities/Task';

export class CreateTaskUseCase {
  constructor(
    // Should inject ITaskRepository (interface), not concrete impl
    private readonly taskRepository: InMemoryTaskRepository
  ) {}

  async execute(title: string, description: string, categoryId: string): Promise<Task> {
    const task = new Task(
      crypto.randomUUID(),
      title,
      description,
      false,
      categoryId,
      new Date()
    );
    return this.taskRepository.save(task);
  }
}
