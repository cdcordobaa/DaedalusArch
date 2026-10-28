import type { Clock } from '../../../application/ports/out/clock.port';

export class SystemClock implements Clock {
  now(): Date { return new Date(); }
}
