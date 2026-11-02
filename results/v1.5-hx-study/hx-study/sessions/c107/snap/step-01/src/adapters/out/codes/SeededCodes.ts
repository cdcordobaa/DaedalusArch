import type { CodeIssuer } from '../../../application/ports/out/CodeIssuer';

/** Pseudo-random six-digit codes from a seed (Park-Miller), so a run can be replayed. */
export class SeededCodes implements CodeIssuer {
  private state: number;

  constructor(seed: number) {
    this.state = Math.max(1, Math.floor(seed) % 2147483647);
  }

  next(): string {
    this.state = (this.state * 48271) % 2147483647;
    return String(100000 + (this.state % 900000));
  }
}
