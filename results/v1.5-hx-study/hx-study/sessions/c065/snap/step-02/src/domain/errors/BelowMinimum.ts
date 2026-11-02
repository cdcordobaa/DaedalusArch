import { SupplyRefused } from './SupplyRefused';

/** The order is worth less than the depot's minimum; missing is the shortfall in euros, or null when unknown. */
export class BelowMinimum extends SupplyRefused {
  constructor(readonly missing: number | null) {
    super('BELOW_MINIMUM');
    this.name = 'BelowMinimum';
  }
}
