import { BakeryError } from './BakeryError';

/** The order is below the depot's minimum order value; missing is the shortfall in euros, or null when unknown. */
export class BelowMinimum extends BakeryError {
  constructor(readonly missing: number | null) {
    super('Below the minimum order value' + (missing === null ? '' : ' (missing ' + missing + ')'));
    this.name = 'BelowMinimum';
  }
}
