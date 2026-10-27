import type { Clock } from '../../../application/ports/out/Clock';

/** The school's day: the given source, or the system date (UTC). */
export class SchoolClock implements Clock {
  constructor(private readonly source?: () => string) {}

  today(): string {
    return this.source !== undefined ? this.source() : new Date().toISOString().slice(0, 10);
  }
}
