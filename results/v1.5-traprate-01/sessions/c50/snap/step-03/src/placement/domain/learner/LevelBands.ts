import type { Cefr } from '../../../shared-kernel/Cefr';

/** Lowest standing that holds each level, highest level first. Every standing below the last floor is A1. */
const LEVEL_FLOORS: ReadonlyArray<readonly [Cefr, number]> = [
  ['C1', 90],
  ['B2', 75],
  ['B1', 55],
  ['A2', 40],
];

export function levelForStanding(standing: number): Cefr {
  for (const [level, floor] of LEVEL_FLOORS) {
    if (standing >= floor) return level;
  }
  return 'A1';
}
