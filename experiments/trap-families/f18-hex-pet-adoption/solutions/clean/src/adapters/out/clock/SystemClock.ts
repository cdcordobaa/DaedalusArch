import type { Clock } from '../../../application/ports/out/Clock';

/** Today from a supplied function, or from the system clock (UTC). */
export class SystemClock implements Clock {
  constructor(private readonly source: () => string = () => new Date().toISOString().slice(0, 10)) {}

  today(): string {
    return this.source();
  }
}
