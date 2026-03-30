import { ICreateTaskUseCase } from '../../application/use-cases/ICreateTaskUseCase';
import { ICompleteTaskUseCase } from '../../application/use-cases/ICompleteTaskUseCase';

export class TaskController {
  constructor(
    private readonly createTaskUseCase: ICreateTaskUseCase,
    private readonly completeTaskUseCase: ICompleteTaskUseCase
  ) {}

  async createTask(title: string, description: string, categoryId: string) {
    return this.createTaskUseCase.execute(title, description, categoryId);
  }

  async completeTask(id: string) {
    return this.completeTaskUseCase.execute(id);
  }
}
