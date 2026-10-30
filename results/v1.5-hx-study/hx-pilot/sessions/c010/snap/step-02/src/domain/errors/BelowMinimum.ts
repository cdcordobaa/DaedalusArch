import { BakeryError } from './BakeryError';

/** The order is worth less than the depot's minimum; missing is the shortfall in euros, null when unknown. */
export class BelowMinimum extends BakeryError {
  constructor(readonly missing: number | null) {
    super('Below the minimum order value' + (missing === null ? '' : ' (' + missing + ' EUR missing)'));
    this.name = 'BelowMinimum';
  }
}
