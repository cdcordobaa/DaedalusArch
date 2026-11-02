import { BakeryError } from './BakeryError';

/** The supplier has run out of the requested flour. */
export class OutOfStock extends BakeryError {
  constructor(readonly sku: string) {
    super('The flour ' + sku + ' is out of stock');
    this.name = 'OutOfStock';
  }
}
