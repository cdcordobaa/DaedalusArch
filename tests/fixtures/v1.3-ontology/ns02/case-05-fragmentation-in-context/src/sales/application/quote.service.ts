import type { Client } from '../domain/client';
import { DiscountPolicy } from '../domain/discount-policy';

export class QuoteService {
  constructor(private readonly discounts: DiscountPolicy) {}

  quoteFor(client: Client, listPrice: number): number | null {
    const price = listPrice * (1 - this.discounts.rateFor(listPrice));
    return client.canAfford(price) ? price : null;
  }
}
