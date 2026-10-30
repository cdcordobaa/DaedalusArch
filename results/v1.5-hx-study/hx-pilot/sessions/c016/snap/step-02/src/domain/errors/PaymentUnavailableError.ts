import { PaymentError } from './PaymentError';

export class PaymentUnavailableError extends PaymentError {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentUnavailableError';
  }
}
