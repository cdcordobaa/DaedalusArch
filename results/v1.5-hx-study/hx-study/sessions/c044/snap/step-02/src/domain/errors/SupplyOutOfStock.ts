import { SupplyRefused } from './SupplyRefused';

/** The supplier ran out of the flour after the list was loaded. */
export class SupplyOutOfStock extends SupplyRefused {
  constructor() {
    super('sold out');
    this.name = 'SupplyOutOfStock';
  }
}
