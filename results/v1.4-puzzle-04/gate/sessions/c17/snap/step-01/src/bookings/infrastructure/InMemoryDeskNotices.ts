import type { DeskNotices } from '../application/ports/DeskNotices';

export class InMemoryDeskNotices implements DeskNotices {
  private readonly lines: string[] = [];

  add(text: string): void {
    this.lines.push(text);
  }

  all(): string[] {
    return [...this.lines];
  }
}
