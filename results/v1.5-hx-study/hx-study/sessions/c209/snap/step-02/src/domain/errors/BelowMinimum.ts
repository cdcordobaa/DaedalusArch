import { SupplyRefused } from './SupplyRefused';

/** The order is worth less than the depot's minimum; missing is the shortfall in euros, null when the supplier did not say. */
export class BelowMinimum extends SupplyRefused {
  constructor(detail: string, readonly missing: number | null) {
    super(detail);
    this.name = 'BelowMinimum';
  }
}
