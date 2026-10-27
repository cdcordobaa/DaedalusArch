import type { DeclineReason } from './CardCharge';
import type { Money } from './Money';

/** How an order is paid: the amount asked of the customer and our reference for it. */
export interface Payment {
  readonly status: 'paid' | 'invoiced' | 'declined';
  readonly amount: Money;
  readonly reference?: string;
  readonly declineReason?: DeclineReason;
}
