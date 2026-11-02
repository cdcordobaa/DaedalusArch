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
}
