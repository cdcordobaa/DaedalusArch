import { Task } from '../../domain/entities/Task';
import { ITaskRepository } from '../../domain/repositories/ITaskRepository';

export interface CreateTaskInput {
  title: string;
  description: string;
  categoryId: string;
}

export class CreateTaskUseCase {
  constructor(private readonly taskRepository: ITaskRepository) {}

  async execute(input: CreateTaskInput): Promise<Task> {
    const task = new Task(
      crypto.randomUUID(),
      input.title,
      input.description,
      false,
      input.categoryId,
      new Date()
    );

    if (!task.isValid()) {
      throw new Error('Invalid task data');
    }

    return this.taskRepository.save(task);
  }
}
