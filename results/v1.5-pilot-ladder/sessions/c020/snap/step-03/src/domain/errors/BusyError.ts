import { TicketError } from './TicketError';

/** Crowdgate is overloaded; the visitor should try again after retryAfterSeconds. */
export class BusyError extends TicketError {
  readonly statusCode = 503;

  constructor(readonly retryAfterSeconds: number) {
    super('Please try again in a moment.');
    this.name = 'BusyError';
  }
}
