import { ClinicError } from './ClinicError';

/** A booking we refuse ourselves; the front desk screen shows the code. */
export class BookingRefused extends ClinicError {
  constructor(readonly code: 'OPEN_BILL' | 'NOT_REGISTERED', message: string) {
    super(message);
    this.name = 'BookingRefused';
  }
}
