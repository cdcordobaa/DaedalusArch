import type { Clock } from '../domain/clock';
// NM-IO5: I/O in infrastructure is where it belongs.
export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}
