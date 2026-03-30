import { Task } from '../../domain/entities/Task';

export interface ICreateTaskUseCase {
  execute(title: string, description: string, categoryId: string): Promise<Task>;
}
