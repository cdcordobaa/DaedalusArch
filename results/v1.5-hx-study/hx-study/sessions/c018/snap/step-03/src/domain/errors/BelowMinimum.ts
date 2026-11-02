import { BakeryError } from './BakeryError';

/** The order is worth less than the depot's minimum order value. */
export class BelowMinimum extends BakeryError {
  /** @param missing euros the order still lacks, or null when the supplier does not say */
  constructor(readonly missing: number | null) {
    super('The order is below the depot minimum');
    this.name = 'BelowMinimum';
  }
}
