import type { AttendantNotices } from '../application/ports/AttendantNotices';

export class InMemoryAttendantNotices implements AttendantNotices {
  private readonly lines: string[] = [];

  add(text: string): void {
    this.lines.push(text);
  }

  all(): string[] {
    return [...this.lines];
  }
}
