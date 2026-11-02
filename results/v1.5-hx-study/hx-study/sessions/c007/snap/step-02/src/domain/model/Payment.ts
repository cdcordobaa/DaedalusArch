import type { Money } from './Money';

/** A completed card payment: the amount charged and the processor's charge id. */
export interface Payment {
  readonly status: 'paid';
  readonly amount: Money;
  readonly reference: string;
}
