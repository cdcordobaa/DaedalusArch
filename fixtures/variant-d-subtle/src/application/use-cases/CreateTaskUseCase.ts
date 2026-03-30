import { Task } from '../../domain/entities/Task';
import { ITaskRepository } from '../../domain/repositories/ITaskRepository';
import { InfraLogger } from '../../infrastructure/logging/InfraLogger';

// SUBTLE VIOLATION #1: 3 of 4 injections use interfaces, but InfraLogger is concrete
export class CreateTaskUseCase {
  constructor(
    private readonly taskRepository: ITaskRepository,   // ✓ interface
    private readonly logger: InfraLogger                 // ✗ concrete class (subtle)
  ) {}

  async execute(title: string, description: string, categoryId: string): Promise<Task> {
    this.logger.log(`Creating task: ${title}`);
    const task = new Task(crypto.randomUUID(), title, description, false, categoryId, new Date());
    if (!task.isValid()) throw new Error('Invalid task');
    return this.taskRepository.save(task);
  }
}
