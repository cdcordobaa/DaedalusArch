import { SupplyRefused } from './SupplyRefused';

/** The supplier's depot has run out of the flour that was ordered. */
export class SoldOut extends SupplyRefused {
  constructor(detail: string) {
    super(detail);
    this.name = 'SoldOut';
  }
}
