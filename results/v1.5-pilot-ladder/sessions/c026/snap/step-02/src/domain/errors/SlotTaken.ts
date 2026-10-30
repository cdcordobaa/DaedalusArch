import { CalendarRefused } from './CalendarRefused';

/** The slot was reserved by someone else before this booking reached the calendar. */
export class SlotTaken extends CalendarRefused {
  constructor(detail: string) {
    super(detail);
    this.name = 'SlotTaken';
  }
}
