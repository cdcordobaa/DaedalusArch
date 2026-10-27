import type { Pool } from './Pool';

const MINUTE = 60;
/** The most a rider may add to a pool's drive; drives of more than 40 minutes allow 12. */
export const DETOUR_LIMIT_SECONDS = 8 * MINUTE;
export const LONG_DRIVE_SECONDS = 40 * MINUTE;
export const LONG_DETOUR_LIMIT_SECONDS = 12 * MINUTE;

/** An open pool the rider could join: its drive without the rider, how much longer it becomes, and whether that needs a ferry. */
export interface Candidate {
  readonly pool: Pool;
  readonly poolSeconds: number;
  readonly addedSeconds: number;
  readonly byFerry: boolean;
}

export class Matching {
  limitFor(poolSeconds: number): number {
    return poolSeconds > LONG_DRIVE_SECONDS ? LONG_DETOUR_LIMIT_SECONDS : DETOUR_LIMIT_SECONDS;
  }

  allows(c: Candidate): boolean {
    return !c.byFerry && c.addedSeconds <= this.limitFor(c.poolSeconds);
  }

  /** The allowed candidate with the smallest added time; on equal times the earlier one (pools come in opening order). */
  choose(candidates: readonly Candidate[]): Candidate | undefined {
    let best: Candidate | undefined;
    for (const c of candidates) {
      if (!this.allows(c)) continue;
      if (best === undefined || c.addedSeconds < best.addedSeconds) best = c;
    }
    return best;
  }
}
