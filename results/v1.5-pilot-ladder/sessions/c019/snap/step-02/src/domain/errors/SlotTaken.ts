import { CalendarRefused } from './CalendarRefused';

/** The slot was taken by someone else in the meantime. */
export class SlotTaken extends CalendarRefused {
  constructor() {
    super('SLOT_TAKEN');
    this.name = 'SlotTaken';
  }
}
