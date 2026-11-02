import { BakeryError } from './BakeryError';

/** The order is worth less than the depot's minimum; shortfall is in euros, null when the supplier did not say. */
export class BelowMinimum extends BakeryError {
  constructor(readonly shortfall: number | null) {
    super('Below the minimum order value' + (shortfall === null ? '' : ' (missing ' + shortfall + ')'));
    this.name = 'BelowMinimum';
  }
}
