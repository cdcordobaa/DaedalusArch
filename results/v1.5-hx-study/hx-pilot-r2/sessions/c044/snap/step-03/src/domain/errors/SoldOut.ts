import { BakeryError } from './BakeryError';

/** The supplier's depot has no more of the requested flour. */
export class SoldOut extends BakeryError {
  constructor(readonly sku: string) {
    super('The supplier is sold out of ' + sku);
    this.name = 'SoldOut';
  }
}
