import { BakeryError } from './BakeryError';

/** The supplier has no longer enough bags of the flour in stock. */
export class SoldOut extends BakeryError {
  constructor(readonly sku: string) {
    super('The flour ' + sku + ' is sold out');
    this.name = 'SoldOut';
  }
}
