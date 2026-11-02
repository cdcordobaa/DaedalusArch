import { SupplyRefused } from './SupplyRefused';

/** The supplier ran out of the flour after the list was loaded. */
export class SoldOut extends SupplyRefused {
  constructor() {
    super('OUT_OF_STOCK');
    this.name = 'SoldOut';
  }
}
