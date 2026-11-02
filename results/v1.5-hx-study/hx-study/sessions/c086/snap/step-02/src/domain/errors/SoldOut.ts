import { BakeryError } from './BakeryError';

/** The supplier has no (more) stock of the requested flour. */
export class SoldOut extends BakeryError {
  constructor(readonly sku: string) {
    super('Sold out (' + sku + ')');
    this.name = 'SoldOut';
  }
}
