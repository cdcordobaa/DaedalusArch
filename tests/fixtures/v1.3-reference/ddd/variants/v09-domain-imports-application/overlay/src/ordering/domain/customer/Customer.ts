import { CustomerId } from './value-objects/CustomerId.js';
// VIOLATION (layering inside the context): the domain depends on the application layer.
import type { PlaceOrderCommand } from '../../application/PlaceOrder.js';

/** Aggregate root with no inner entity. */
export class Customer {
  private active = true;

  constructor(readonly id: CustomerId, readonly name: string) {}

  canOrder(): boolean {
    return this.active;
  }

  deactivate(): void {
    this.active = false;
  }

  owns(cmd: PlaceOrderCommand): boolean {
    return cmd.customerId === this.id.value;
  }
}
