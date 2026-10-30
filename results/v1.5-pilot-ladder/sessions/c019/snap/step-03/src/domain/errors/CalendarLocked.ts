import { CalendarRefused } from './CalendarRefused';

/** The calendar is locked for its nightly maintenance. */
export class CalendarLocked extends CalendarRefused {
  constructor() {
    super('CALENDAR_LOCKED');
    this.name = 'CalendarLocked';
  }
}
