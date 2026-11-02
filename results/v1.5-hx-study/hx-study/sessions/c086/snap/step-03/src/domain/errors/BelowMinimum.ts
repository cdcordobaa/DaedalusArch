import { BakeryError } from './BakeryError';

/** The order is worth less than the depot's minimum. missing is in euros, null when unknown. */
export class BelowMinimum extends BakeryError {
  constructor(readonly missing: number | null) {
    super('Order below the depot minimum');
    this.name = 'BelowMinimum';
  }
}
