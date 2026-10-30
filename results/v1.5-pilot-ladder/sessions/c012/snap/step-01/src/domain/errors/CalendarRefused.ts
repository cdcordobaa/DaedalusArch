import { ClinicError } from './ClinicError';

/** The calendar would not take the booking; detail is what it said, shown to the front desk as is. */
export class CalendarRefused extends ClinicError {
  constructor(readonly detail: string) {
    super('The calendar refused the booking (' + detail + ')');
    this.name = 'CalendarRefused';
  }
}
