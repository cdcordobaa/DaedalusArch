import { BakeryError } from './BakeryError';

/** The order is worth less than the supplier's minimum; missing is the difference in euros, when known. */
export class BelowMinimum extends BakeryError {
  constructor(readonly missing: number | null) {
    super('the order is under the minimum');
    this.name = 'BelowMinimum';
  }
}
