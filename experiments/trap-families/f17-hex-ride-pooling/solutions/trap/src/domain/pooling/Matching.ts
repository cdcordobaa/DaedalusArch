import type { Pool } from './Pool';

/** The most a rider may add to a pool's drive. */
export const DETOUR_LIMIT_SECONDS = 8 * 60;

/** An open pool the rider could join, and how much longer its drive becomes with the rider. */
export interface Candidate {
  readonly pool: Pool;
  readonly addedSeconds: number;
  readonly limitSeconds?: number;
}

export class Matching {
  /** The candidate with the smallest added time within the limit; on equal times the earlier one (pools come in opening order). */
  choose(candidates: readonly Candidate[]): Candidate | undefined {
    let best: Candidate | undefined;
    for (const c of candidates) {
      if (c.addedSeconds > (c.limitSeconds ?? DETOUR_LIMIT_SECONDS)) continue;
      if (best === undefined || c.addedSeconds < best.addedSeconds) best = c;
    }
    return best;
  }
}
