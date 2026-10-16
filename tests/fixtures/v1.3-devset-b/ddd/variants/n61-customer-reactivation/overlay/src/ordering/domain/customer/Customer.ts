import { CustomerId } from './value-objects/CustomerId.js';

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

  reactivate(): void {
    if (this.active) throw new Error('Customer is already active');
    this.active = true;
  }
}
