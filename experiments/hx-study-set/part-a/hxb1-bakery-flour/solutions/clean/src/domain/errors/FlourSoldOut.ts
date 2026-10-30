import { BakeryError } from './BakeryError';

/** The supplier has no more of this flour for now. */
export class FlourSoldOut extends BakeryError {
  constructor() {
    super('the flour is sold out');
    this.name = 'FlourSoldOut';
  }
}
