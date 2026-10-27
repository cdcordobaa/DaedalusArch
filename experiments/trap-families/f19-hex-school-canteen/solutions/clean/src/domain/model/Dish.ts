import { CanteenError } from '../errors/CanteenError';
import type { Allergen } from './Allergens';
import type { Pence } from './Pence';

export class Dish {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly price: Pence,
    readonly allergens: readonly Allergen[],
  ) {
    Dish.checkName(name);
  }

  /** Refuses a blank name before an id is taken. */
  static checkName(name: string): void {
    if (name.trim() === '') throw new CanteenError('a dish needs a name');
  }
}
