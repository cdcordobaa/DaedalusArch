import { CustomerId } from './value-objects/CustomerId.js';
import type { OrderLine } from '../order/OrderLine.js';

/** Aggregate root with no inner entity. */
export class Customer {
  private active = true;
  private lastLine: OrderLine | null = null;

  constructor(readonly id: CustomerId, readonly name: string) {}

  canOrder(): boolean {
    return this.active;
  }

  deactivate(): void {
    this.active = false;
  }

  remember(line: OrderLine): void {
    this.lastLine = line;
  }

  lastProduct(): string | null {
    return this.lastLine?.productId ?? null;
  }
}
