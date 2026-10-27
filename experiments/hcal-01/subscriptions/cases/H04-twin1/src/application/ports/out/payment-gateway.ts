import { Money } from '../../../domain/money';

export interface PaymentResult {
  readonly success: boolean;
  readonly transactionId: string;
}

export interface PaymentGateway {
  charge(customerId: string, amount: Money, reference: string): Promise<PaymentResult>;
  refund?(transactionId: string, amount: Money): Promise<void>;
}
