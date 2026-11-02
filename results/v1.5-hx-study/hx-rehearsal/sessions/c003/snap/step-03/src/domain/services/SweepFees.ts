import { PlanError } from '../errors/PlanError';

/** Our fee per sweep: the first flue, then each further flue in the same house. */
export class SweepFees {
  static readonly FIRST_FLUE = 70;
  static readonly EXTRA_FLUE = 25;

  fee(flues: number): number {
    if (!Number.isInteger(flues) || flues < 1 || flues > 4) throw new PlanError('a plan covers 1 to 4 flues');
    return SweepFees.FIRST_FLUE + (flues - 1) * SweepFees.EXTRA_FLUE;
  }

  sweepsPerYear(n: number): number {
    if (!Number.isInteger(n) || n < 1 || n > 3) throw new PlanError('a plan has 1 to 3 sweeps a year');
    return n;
  }

  /** Fails when the plan's sweeps in the calendar year of `date` are used up. */
  ensureSweepLeft(sweeps: readonly string[], sweepsPerYear: number, date: string): void {
    const year = date.slice(0, 4);
    const used = sweeps.filter((d) => d.slice(0, 4) === year).length;
    if (used >= sweepsPerYear) throw new PlanError('This plan has no sweeps left this year.');
  }
}
