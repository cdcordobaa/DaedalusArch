import type { Money } from './Money';

/** How an order is paid: the amount charged and the payment reference (the processor's charge id for cards). */
export interface Payment {
  readonly status: 'paid';
  readonly amount: Money;
  readonly reference: string;
}
