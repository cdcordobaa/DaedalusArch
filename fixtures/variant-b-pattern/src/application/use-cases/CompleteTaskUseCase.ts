import { Task } from '../../domain/entities/Task';
import { InMemoryTaskRepository } from '../../infrastructure/repositories/InMemoryTaskRepository';

// VIOLATION #2: injects concrete InMemoryTaskRepository instead of ITaskRepository
export class CompleteTaskUseCase {
  constructor(private readonly taskRepository: InMemoryTaskRepository) {}

  async execute(id: string): Promise<Task> {
    const task = await this.taskRepository.findById(id);
    if (!task) throw new Error(`Task ${id} not found`);
    return this.taskRepository.save(task.complete());
  }
}
