import type { Notices } from '../application/ports/Notices';

export class InMemoryNotices implements Notices {
  private readonly lines: string[] = [];

  add(carId: string, text: string): void {
    this.lines.push(`${carId}: ${text}`);
  }

  all(): string[] {
    return [...this.lines];
  }
}
