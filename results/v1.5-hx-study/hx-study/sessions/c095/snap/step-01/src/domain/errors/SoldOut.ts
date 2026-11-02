import { SupplyRefused } from './SupplyRefused';

/** The supplier has run out of the requested flour. */
export class SoldOut extends SupplyRefused {
  constructor() {
    super('sold out');
    this.name = 'SoldOut';
  }
}
