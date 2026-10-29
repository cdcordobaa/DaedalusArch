import { TicketError } from './TicketError';

/** The door system asked us to wait before trying again. */
export class GateBusy extends TicketError {
  constructor(readonly retryInSeconds: number) {
    super('Please try again in a moment.');
    this.name = 'GateBusy';
  }
}
