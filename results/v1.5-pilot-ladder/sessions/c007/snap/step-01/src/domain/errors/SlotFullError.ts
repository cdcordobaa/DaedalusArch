import { TicketError } from './TicketError';

/** The requested time slot has no room left. */
export class SlotFullError extends TicketError {
  readonly statusCode = 409;
  readonly userMessage = 'This time slot is full.';

  constructor() {
    super('slot_full', 'slot');
    this.name = 'SlotFullError';
  }
}
