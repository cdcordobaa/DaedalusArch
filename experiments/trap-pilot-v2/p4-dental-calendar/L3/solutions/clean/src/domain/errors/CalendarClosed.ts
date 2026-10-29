import { ClinicError } from './ClinicError';

export class CalendarClosed extends ClinicError {
  constructor() {
    super('the calendar is closed');
    this.name = 'CalendarClosed';
  }
}
