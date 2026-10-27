import type { CoordinatorNotices } from '../application/ports/CoordinatorNotices';

export class InMemoryCoordinatorNotices implements CoordinatorNotices {
  private readonly lines: string[] = [];

  add(text: string): void {
    this.lines.push(text);
  }

  all(): string[] {
    return [...this.lines];
  }
}
