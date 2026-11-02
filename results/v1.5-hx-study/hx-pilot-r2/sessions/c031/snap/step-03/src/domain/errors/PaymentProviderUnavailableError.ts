import { PaymentError } from './PaymentError';

/** The card payment provider could not be reached or is down. */
export class PaymentProviderUnavailableError extends PaymentError {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentProviderUnavailableError';
  }
}
