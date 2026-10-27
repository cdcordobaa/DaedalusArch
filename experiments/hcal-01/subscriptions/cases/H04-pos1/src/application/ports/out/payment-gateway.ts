import { Money } from '../../../domain/money';
import type { Charge } from 'stripe';

export interface PaymentResult {
  readonly success: boolean;
  readonly transactionId: string;
}

export interface PaymentGateway {
  charge(customerId: string, amount: Money, reference: string): Promise<PaymentResult>;
  refund?(charge: Charge): Promise<void>;
}
