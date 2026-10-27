import type { Notices } from '../application/ports/Notices';

export class InMemoryNotices implements Notices {
  private readonly lines: string[] = [];

  add(sectionId: string, text: string): void {
    this.lines.push(`${sectionId}: ${text}`);
  }

  all(): string[] {
    return [...this.lines];
  }
}
