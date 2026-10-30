import { PaymentError } from '../errors/PaymentError';
import { Money } from './Money';

/** An order at checkout: an id and a positive total in a three-letter currency. */
export class Order {
  private constructor(
    readonly id: string,
    readonly total: Money,
  ) {}

  static of(id: string, total: number, currency: string): Order {
    if (id.trim() === '') throw new PaymentError('an order needs an id');
    if (!/^[A-Z]{3}$/.test(currency)) throw new PaymentError('currency must be a three-letter code');
    const money = Money.of(total, currency);
    if (!Number.isFinite(total) || !money.isPositive()) throw new PaymentError('the order amount must be positive');
    return new Order(id, money);
  }
}
