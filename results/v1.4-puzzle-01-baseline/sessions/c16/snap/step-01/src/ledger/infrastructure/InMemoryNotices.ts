import type { Notices } from '../application/ports/Notices';

export class InMemoryNotices implements Notices {
  private readonly lines: string[] = [];

  add(accountId: string, text: string): void {
    this.lines.push(`${accountId}: ${text}`);
  }

  all(): string[] {
    return [...this.lines];
  }
}
