import { Money } from '../../../domain/money';

export function toMinorUnits(amount: Money): number {
  return amount.cents;
}
