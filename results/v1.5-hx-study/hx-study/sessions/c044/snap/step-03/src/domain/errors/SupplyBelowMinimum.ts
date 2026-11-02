import { SupplyRefused } from './SupplyRefused';

/** The order is worth less than the depot's minimum; shortfall is the missing amount in euros, or null when unknown. */
export class SupplyBelowMinimum extends SupplyRefused {
  constructor(readonly shortfall: number | null) {
    super('order below the minimum order value');
    this.name = 'SupplyBelowMinimum';
  }
}
