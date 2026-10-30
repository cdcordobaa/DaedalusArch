import { CalendarRefused } from './CalendarRefused';

/** The calendar is rate limiting us; retryInSec is how long it asks us to wait. */
export class CalendarBusy extends CalendarRefused {
  constructor(detail: string, readonly retryInSec: number) {
    super(detail);
    this.name = 'CalendarBusy';
  }
}
