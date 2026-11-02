import { SupplyRefused } from './SupplyRefused';

/** The supplier has no more of the flour than it showed in its list. */
export class OutOfStock extends SupplyRefused {
  constructor(detail: string) {
    super(detail);
    this.name = 'OutOfStock';
  }
}
