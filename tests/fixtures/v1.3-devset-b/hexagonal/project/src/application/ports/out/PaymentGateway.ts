import { Money } from '../../../domain/model/Money';

/** Driven port (Cockburn 2005): charges and refunds payments, implemented by an outbound adapter. */
export interface PaymentGateway {
  charge(guestId: string, amount: Money): Promise<string>;
  refund(paymentRef: string): Promise<void>;
}
