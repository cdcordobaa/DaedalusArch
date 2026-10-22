import type { Money } from '../../../shared-kernel/Money';
import type { Customer } from '../../domain/customer/Customer';

export interface CreditDecision {
  readonly approved: boolean;
  readonly reason: string;
}

/** Asks whether this customer may buy this amount on credit. A question: it changes nothing. */
export interface CreditCheck {
  assess(customer: Customer, amount: Money): CreditDecision;
}
