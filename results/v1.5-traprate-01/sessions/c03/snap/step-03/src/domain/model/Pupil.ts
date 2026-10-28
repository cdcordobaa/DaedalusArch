import { CanteenError } from '../errors/CanteenError';
import type { Allergen } from './Allergens';
import { formatPence, type Pence } from './Pence';

export class Pupil {
  private balancePence: Pence = 0;

  constructor(
    readonly id: string,
    readonly name: string,
    readonly className: string,
    readonly allergies: readonly Allergen[],
  ) {
    Pupil.checkDetails(name, className);
  }

  /** Refuses a blank name or class before an id is taken. */
  static checkDetails(name: string, className: string): void {
    if (name.trim() === '') throw new CanteenError('a pupil needs a name');
    if (className.trim() === '') throw new CanteenError('a pupil needs a class');
  }

  get balance(): Pence {
    return this.balancePence;
  }

  /** The first of the given allergens this pupil is allergic to, or null. */
  allergicToAnyOf(allergens: readonly Allergen[]): Allergen | null {
    return allergens.find((a) => this.allergies.includes(a)) ?? null;
  }

  hasAllergies(): boolean {
    return this.allergies.length > 0;
  }

  credit(amount: Pence): void {
    this.balancePence += amount;
  }

  debit(amount: Pence): void {
    if (amount > this.balancePence) throw new CanteenError(`balance too low: ${formatPence(this.balancePence)} left, the meal costs ${formatPence(amount)}`);
    this.balancePence -= amount;
  }
}
