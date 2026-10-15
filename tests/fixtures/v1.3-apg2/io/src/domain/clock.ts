// NM-IO2: a domain port; calling it is not I/O.
export interface Clock {
  now(): number;
}
export class Deadline {
  constructor(private readonly clock: Clock) {}
  expired(at: number): boolean {
    return this.clock.now() > at;
  }
}
