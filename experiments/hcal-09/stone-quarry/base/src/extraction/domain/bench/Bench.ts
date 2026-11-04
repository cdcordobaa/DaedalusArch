import { Blast } from '../blast/Blast';
import { PermitExceededError } from './PermitExceededError';

export class Bench {
  constructor(
    readonly id: string,
    readonly face: string,
    readonly permittedTonnesPerMonth: number,
  ) {}

  /** Invariant bench-monthly-permit: the blasts planned on this bench in one month stay within the monthly permit. */
  authoriseBlast(blastsThisMonth: readonly Blast[], blastId: string, plannedTonnes: number, month: string): Blast {
    const planned = blastsThisMonth
      .filter((b) => b.benchId === this.id && b.month === month)
      .reduce((sum, b) => sum + b.plannedTonnes, 0);
    if (planned + plannedTonnes > this.permittedTonnesPerMonth) throw new PermitExceededError(this.id, month);
    return Blast.plan(blastId, this.id, plannedTonnes, month);
  }
}
