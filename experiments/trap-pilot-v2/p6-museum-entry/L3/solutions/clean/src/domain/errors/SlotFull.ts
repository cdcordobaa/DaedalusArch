import { TicketError } from './TicketError';

/** Every place in the slot is taken; nextSlot is the next one with room that day, when known. */
export class SlotFull extends TicketError {
  constructor(readonly nextSlot?: string) {
    super('This time slot is full.');
    this.name = 'SlotFull';
  }
}
