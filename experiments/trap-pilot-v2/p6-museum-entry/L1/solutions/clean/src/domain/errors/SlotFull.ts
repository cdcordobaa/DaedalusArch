import { TicketError } from './TicketError';

/** Every place in the slot is taken. */
export class SlotFull extends TicketError {
  constructor() {
    super('This time slot is full.');
    this.name = 'SlotFull';
  }
}
