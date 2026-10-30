import { CalendarRefused } from './CalendarRefused';

/** The calendar asked us to slow down; retryAfterSec is how long to wait before trying again. */
export class RateLimited extends CalendarRefused {
  constructor(readonly retryAfterSec: number) {
    super('RATE_LIMITED');
    this.name = 'RateLimited';
  }
}
