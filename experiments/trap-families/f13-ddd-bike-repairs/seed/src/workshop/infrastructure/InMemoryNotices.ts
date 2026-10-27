import type { Notices } from '../application/ports/Notices';

export class InMemoryNotices implements Notices {
  private readonly lines: string[] = [];

  add(jobId: string, text: string): void {
    this.lines.push(`${jobId}: ${text}`);
  }

  all(): string[] {
    return [...this.lines];
  }
}
