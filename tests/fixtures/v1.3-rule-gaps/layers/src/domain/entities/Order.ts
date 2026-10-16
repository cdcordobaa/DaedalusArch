import { Money } from '../value-objects/Money';

export class Order {
  private status: 'open' | 'paid' = 'open';
  constructor(readonly id: string, readonly total: Money) {}
  // look-alike (service-stateless): an entity tracks its own state; it is not a service.
  pay(): void {
    this.status = 'paid';
  }
  isPaid(): boolean {
    return this.status === 'paid';
  }
}
