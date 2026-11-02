import { PaymentError } from './PaymentError';

/** The payment provider could not be reached; the order can still be placed on invoice. */
export class PaymentUnavailableError extends PaymentError {
  constructor(message = 'the payment service is unavailable, please try again') {
    super(message);
    this.name = 'PaymentUnavailableError';
  }
}
