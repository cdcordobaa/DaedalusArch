import type { Clock } from '../../../application/ports/out/Clock';

export class BuildingClock implements Clock {
  constructor(private readonly source: () => string) {}

  now(): string {
    return this.source();
  }
}
