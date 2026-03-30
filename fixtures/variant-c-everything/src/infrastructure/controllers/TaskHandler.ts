import { CreateTaskUseCase } from '../../application/use-cases/CreateTaskUseCase';
import * as prisma from '@prisma/client'; // BYPASS VIOLATION: direct DB import in controller

// VIOLATION: named "TaskHandler" instead of "TaskController" — naming convention violation
export class TaskHandler {
  constructor(private readonly createTaskUseCase: CreateTaskUseCase) {}

  async handle(title: string, description: string, categoryId: string) {
    return this.createTaskUseCase.execute(title, description, categoryId);
  }
}
