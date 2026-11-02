import { BakeryError } from './BakeryError';

/** The supplier's depot has too few bags of the flour to take the order. */
export class OutOfStock extends BakeryError {
  constructor(readonly sku: string) {
    super('The supplier is out of stock of ' + sku);
    this.name = 'OutOfStock';
  }
}
