import type { Client } from '../domain/client';

export class QuoteService {
  quoteFor(client: Client, listPrice: number): number {
    return client.isVip() ? listPrice * 0.95 : listPrice;
  }
}
