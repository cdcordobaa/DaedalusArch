import type { Clock } from '../../../application/ports/out/Clock';
import { instant, type Instant } from '../../../domain/model/Instant';

/** The system clock, or a supplied time source (tests, replays). */
export class SystemClock implements Clock {
  constructor(private readonly source: () => string = () => new Date().toISOString()) {}

  now(): Instant {
    return instant(this.source());
  }
}
