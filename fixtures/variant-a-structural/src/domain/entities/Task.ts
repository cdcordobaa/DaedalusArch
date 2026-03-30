// VIOLATION #1: Domain entity imports InfraConfig from infrastructure layer (wrong direction)
import { InfraConfig } from '../../infrastructure/config/InfraConfig';
import { ITaskRepository } from '../repositories/ITaskRepository';

export class Task {
  static readonly DEFAULT_TIMEOUT = InfraConfig.DEFAULT_TIMEOUT;

  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly description: string,
    public readonly completed: boolean,
    public readonly categoryId: string,
    public readonly createdAt: Date
  ) {}

  complete(): Task {
    return new Task(this.id, this.title, this.description, true, this.categoryId, this.createdAt);
  }

  isValid(): boolean {
    return this.title.length > 0 && this.categoryId.length > 0;
  }
}
