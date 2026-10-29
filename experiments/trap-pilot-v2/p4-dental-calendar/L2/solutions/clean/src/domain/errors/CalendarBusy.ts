import { ClinicError } from './ClinicError';

export class CalendarBusy extends ClinicError {
  constructor(readonly retryInSeconds: number) {
    super('the calendar is busy');
    this.name = 'CalendarBusy';
  }
}
