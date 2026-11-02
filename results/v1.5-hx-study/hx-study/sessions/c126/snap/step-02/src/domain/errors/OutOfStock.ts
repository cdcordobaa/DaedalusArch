import { SupplyRefused } from './SupplyRefused';

/** The supplier ran out of the requested flour. */
export class OutOfStock extends SupplyRefused {
  constructor() {
    super('OUT_OF_STOCK');
    this.name = 'OutOfStock';
  }
}
