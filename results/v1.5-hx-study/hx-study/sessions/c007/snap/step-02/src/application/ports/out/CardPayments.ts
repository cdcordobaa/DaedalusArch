import type { Money } from '../../../domain/model/Money';
import type { Payment } from '../../../domain/model/Payment';

/** Charges a card; throws PaymentError when the payment is not taken. */
export interface CardPayments {
  charge(orderId: string, cardToken: string, amount: Money): Promise<Payment>;
}
