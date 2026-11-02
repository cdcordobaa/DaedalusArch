import type { Money } from './Money';

/** How an order is paid: the amount asked of or charged to the customer and the reference for it. */
export interface Payment {
  readonly status: 'invoiced' | 'paid';
  readonly amount: Money;
  readonly reference: string;
}
