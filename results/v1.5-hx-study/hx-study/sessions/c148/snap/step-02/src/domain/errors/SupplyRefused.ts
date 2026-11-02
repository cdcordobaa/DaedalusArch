import { BakeryError } from './BakeryError';

/** The supplier would not take the order; detail is what it said, shown on the buyer's screen as is. */
export class SupplyRefused extends BakeryError {
  constructor(readonly detail: string, readonly shortfallCents?: number) {
    super('The supplier refused the order (' + detail + ')');
    this.name = 'SupplyRefused';
  }
}
