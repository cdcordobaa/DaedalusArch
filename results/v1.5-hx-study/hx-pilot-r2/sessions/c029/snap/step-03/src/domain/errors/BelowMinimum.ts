import { BakeryError } from './BakeryError';

/** The order is below the depot's minimum order value. */
export class BelowMinimum extends BakeryError {
  /** @param missing amount in euros still lacking, or null when unknown */
  constructor(readonly missing: number | null) {
    super('The order is below the minimum order value');
    this.name = 'BelowMinimum';
  }
}
