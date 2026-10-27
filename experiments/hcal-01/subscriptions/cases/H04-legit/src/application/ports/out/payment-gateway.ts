import { Money } from '../../../domain/money';

export interface ProviderReceipt {
  readonly chargeId: string;
  readonly amountCents: number;
  readonly livemode: boolean;
}

export interface PaymentResult {
  readonly success: boolean;
  readonly transactionId: string;
  readonly receipt?: ProviderReceipt;
}

export interface PaymentGateway {
  charge(customerId: string, amount: Money, reference: string): Promise<PaymentResult>;
}
