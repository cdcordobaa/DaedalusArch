import { Task } from '../../../domain/entities/Task';
import { ITaskRepository } from '../../../domain/repositories/ITaskRepository';

export class CompleteTaskUseCase {
  constructor(private readonly taskRepository: ITaskRepository) {}

  async execute(id: string): Promise<Task> {
    const task = await this.taskRepository.findById(id);
    if (!task) throw new Error(`Task ${id} not found`);
    const completed = task.complete();
    return this.taskRepository.save(completed);
  }
}
