import { ClinicError } from './ClinicError';

export class CalendarError extends ClinicError {
  constructor(readonly code: string, readonly retryAfterSec?: number) {
    super('calendar error ' + code);
    this.name = 'CalendarError';
  }
}
