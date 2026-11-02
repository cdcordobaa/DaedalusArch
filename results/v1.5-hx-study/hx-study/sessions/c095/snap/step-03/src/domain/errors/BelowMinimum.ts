import { SupplyRefused } from './SupplyRefused';

/** The order is worth less than the depot's minimum; missing is the shortfall in euros, null when unknown. */
export class BelowMinimum extends SupplyRefused {
  constructor(readonly missing: number | null) {
    super('order below the minimum order value');
    this.name = 'BelowMinimum';
  }
}
