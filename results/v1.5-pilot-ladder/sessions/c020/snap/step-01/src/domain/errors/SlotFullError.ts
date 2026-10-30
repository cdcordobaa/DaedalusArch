import { TicketError } from './TicketError';

/** The chosen time slot has no room left; the ticket page shows a friendly message. */
export class SlotFullError extends TicketError {
  readonly statusCode = 409;
  readonly code = 'slot_full';

  constructor() {
    super('This time slot is full.');
    this.name = 'SlotFullError';
  }
}
