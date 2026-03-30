// VIOLATION #4: Domain imports @nestjs/common (domain purity violation)
import { Injectable } from '@nestjs/common';

@Injectable()
export class Task {
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
