import { TicketError } from './TicketError';

/** The capacity service is too busy right now; the visitor may retry after a while. */
export class BusyError extends TicketError {
  readonly statusCode = 503;
  readonly userMessage = 'Please try again in a moment.';

  constructor(readonly retryAfterSeconds: number) {
    super('busy');
    this.name = 'BusyError';
  }
}
