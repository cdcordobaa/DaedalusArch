import type { Notices } from '../application/ports/Notices';

export class InMemoryNotices implements Notices {
  private readonly lines: string[] = [];

  add(roomId: string, text: string): void {
    this.lines.push(`${roomId}: ${text}`);
  }

  all(): string[] {
    return [...this.lines];
  }
}
