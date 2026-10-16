import { Clock, IdGenerator } from '../ports/out/clock';

export const systemClock: Clock = { now: () => new Date().toISOString() };

export class SequentialIds implements IdGenerator {
  private n = 0;
  next(prefix: string): string { this.n += 1; return `${prefix}-${this.n}`; }
}
