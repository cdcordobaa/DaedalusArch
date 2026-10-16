import { Token } from 'typedi';

export interface PaymentResult {
  readonly authorised: boolean;
  readonly reference: string;
}

/** Card or invoice payment of an accepted quote. */
export interface PaymentsPort {
  authorise(clientId: string, amountCents: number, purchaseOrder: string): Promise<PaymentResult>;
  refund(reference: string, amountCents: number): Promise<void>;
}

export const PAYMENTS = new Token<PaymentsPort>('payments');
