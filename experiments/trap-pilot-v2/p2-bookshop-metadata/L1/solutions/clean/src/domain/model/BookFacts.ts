import type { Binding } from './Binding';

/** What the catalogue tells us about an edition. */
export interface BookFacts {
  readonly year: number;
  readonly pages: number;
  readonly binding: Binding;
}
