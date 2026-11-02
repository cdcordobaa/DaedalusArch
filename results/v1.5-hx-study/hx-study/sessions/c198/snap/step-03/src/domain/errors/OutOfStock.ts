import { SupplyRefused } from './SupplyRefused';

/** The supplier's depot has run out of the flour that was ordered. */
export class OutOfStock extends SupplyRefused {
  constructor() {
    super('OUT_OF_STOCK');
    this.name = 'OutOfStock';
  }
}
