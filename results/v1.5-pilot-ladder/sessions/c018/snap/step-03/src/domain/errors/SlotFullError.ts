import { TicketError } from './TicketError';

/** Every place in the time slot is taken. */
export class SlotFullError extends TicketError {
  constructor() {
    super('This time slot is full.');
    this.name = 'SlotFullError';
  }
}
