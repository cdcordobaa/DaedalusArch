import { BakeryError } from './BakeryError';

/** The supplier has run out of the requested flour. */
export class SoldOut extends BakeryError {
  constructor(readonly sku: string) {
    super('Sold out: ' + sku);
    this.name = 'SoldOut';
  }
}
