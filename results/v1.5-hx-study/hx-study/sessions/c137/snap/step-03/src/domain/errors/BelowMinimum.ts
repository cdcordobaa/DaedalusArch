import { SupplyRefused } from './SupplyRefused';

/** The order is worth less than the depot's minimum order value. */
export class BelowMinimum extends SupplyRefused {
  /** missing: euros the order still lacks, or null when the supplier did not say. */
  constructor(detail: string, readonly missing: number | null) {
    super(detail);
    this.name = 'BelowMinimum';
  }
}
