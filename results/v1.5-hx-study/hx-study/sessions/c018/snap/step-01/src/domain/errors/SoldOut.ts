import { BakeryError } from './BakeryError';

/** The supplier has run out of the flour that was ordered. */
export class SoldOut extends BakeryError {
  constructor(readonly sku: string) {
    super('The supplier is sold out of ' + sku);
    this.name = 'SoldOut';
  }
}
