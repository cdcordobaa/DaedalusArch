import type { PassHappening } from './happenings';
import type { SkiPass } from './SkiPass';

/** Where passes are kept. `put` writes the pass and what it said in one step. */
export interface PassBook {
  newNumber(): string;
  find(passNo: string): SkiPass | undefined;
  put(pass: SkiPass, said: readonly PassHappening[]): void;
}
