import { CustomerId } from './value-objects/CustomerId.js';
import { isNonEmpty } from './validation/class-validator.js';

/** Aggregate root with no inner entity. */
export class Customer {
  private active = true;

  constructor(readonly id: CustomerId, readonly name: string) {
    if (!isNonEmpty(name)) throw new Error('A customer needs a name');
  }

  canOrder(): boolean {
    return this.active;
  }

  deactivate(): void {
    this.active = false;
  }
}
