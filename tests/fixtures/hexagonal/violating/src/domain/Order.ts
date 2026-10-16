import { SqlOrderGateway } from '../adapters/outbound/SqlOrderGateway.js';

export class Order {
  private readonly gateway: SqlOrderGateway = new SqlOrderGateway();

  constructor(readonly id: string, readonly total: number) {}

  source(): string {
    return this.gateway.describe();
  }
}
