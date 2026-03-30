import { Task } from '../../domain/entities/Task';

export interface ICompleteTaskUseCase {
  execute(id: string): Promise<Task>;
}
