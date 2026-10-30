import { BakeryError } from './BakeryError';

/** The supplier's depot has no more of this flour. */
export class SoldOut extends BakeryError {
  constructor(readonly sku: string) {
    super('Sold out (' + sku + ')');
    this.name = 'SoldOut';
  }
}
