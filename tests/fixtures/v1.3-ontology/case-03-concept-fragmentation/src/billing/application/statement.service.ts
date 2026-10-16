import type { Buyer } from '../domain/buyer';

export class StatementService {
  header(buyer: Buyer): string {
    return `Statement for ${buyer.label()}\n${buyer.billingAddress}`;
  }
}
