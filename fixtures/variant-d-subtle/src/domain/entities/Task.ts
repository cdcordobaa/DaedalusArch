// SUBTLE VIOLATION #2: imports from application utils which re-exports from infra
// The domain entity doesn't directly import infra, but one level of indirection hides it.
import { normalizeTitle } from '../../application/utils/TaskUtils';

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
    return new Task(this.id, normalizeTitle(this.title), this.description, true, this.categoryId, this.createdAt);
  }

  isValid(): boolean {
    return this.title.length > 0 && this.categoryId.length > 0;
  }
}
