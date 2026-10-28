import type { Pool } from './Pool';

/** The most a rider may add to a pool's drive of up to LONG_DRIVE_SECONDS. */
export const DETOUR_LIMIT_SECONDS = 8 * 60;
/** Pools whose drive without the rider is longer than this allow the longer detour. */
export const LONG_DRIVE_SECONDS = 40 * 60;
export const LONG_DETOUR_LIMIT_SECONDS = 12 * 60;

/** An open pool the rider could join, and how much longer its drive becomes with the rider. */
export interface Candidate {
  readonly pool: Pool;
  readonly addedSeconds: number;
  /** The pool's drive time without the rider. */
  readonly withoutSeconds: number;
  /** True when the route with the rider uses a ferry (always false for estimates, which cannot know). */
  readonly usesFerry: boolean;
}

export class Matching {
  /** The candidate with the smallest added time within the limit; on equal times the earlier one (pools come in opening order). */
  choose(candidates: readonly Candidate[]): Candidate | undefined {
    let best: Candidate | undefined;
    for (const c of candidates) {
      if (c.usesFerry) continue;
      const limit = c.withoutSeconds > LONG_DRIVE_SECONDS ? LONG_DETOUR_LIMIT_SECONDS : DETOUR_LIMIT_SECONDS;
      if (c.addedSeconds > limit) continue;
      if (best === undefined || c.addedSeconds < best.addedSeconds) best = c;
    }
    return best;
  }
}
