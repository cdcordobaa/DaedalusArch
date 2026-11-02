import { SupplyRefused } from './SupplyRefused';

/** The supplier's depot has no more of the requested flour. */
export class OutOfStock extends SupplyRefused {
  constructor() {
    super('OUT_OF_STOCK');
    this.name = 'OutOfStock';
  }
}
