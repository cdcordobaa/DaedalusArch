import { PaymentError } from './PaymentError';

/** The card payment service could not be reached right now. */
export class PaymentsUnavailable extends PaymentError {
  constructor(reason: string) {
    super(`card payments unavailable: ${reason}`);
    this.name = 'PaymentsUnavailable';
  }
}
