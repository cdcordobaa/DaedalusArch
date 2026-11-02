import { PaymentError } from './PaymentError';

/** The payment provider could not be reached; the charge was not made. */
export class PaymentUnavailableError extends PaymentError {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentUnavailableError';
  }
}
