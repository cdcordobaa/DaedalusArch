import { SupplyRefused } from './SupplyRefused';

/** The order is worth less than the depot's minimum; shortfall is in euros, null when unknown. */
export class BelowMinimum extends SupplyRefused {
  constructor(readonly shortfall: number | null) {
    super('BELOW_MINIMUM');
    this.name = 'BelowMinimum';
  }
}
