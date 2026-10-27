import type { Clock } from '../../../application/ports/out/Clock';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** A clock that always reads the same instant (demos and checks). */
export class FixedClock implements Clock {
  constructor(private readonly instant: Date) {}

  now(): Date {
    return new Date(this.instant.getTime());
  }
}
