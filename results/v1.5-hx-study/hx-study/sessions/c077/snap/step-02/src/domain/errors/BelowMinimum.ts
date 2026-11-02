import { BakeryError } from './BakeryError';

/** The order is worth less than the depot's minimum order value; missing is the shortfall in euros, or null if unknown. */
export class BelowMinimum extends BakeryError {
  constructor(readonly missing: number | null) {
    super('The order is below the depot minimum');
    this.name = 'BelowMinimum';
  }
}
