import { BakeryError } from './BakeryError';

/** The supplier's depot has no more of the requested flour. */
export class OutOfStock extends BakeryError {
  constructor(readonly sku: string) {
    super('Out of stock (' + sku + ')');
    this.name = 'OutOfStock';
  }
}
