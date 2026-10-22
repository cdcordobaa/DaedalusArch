import { DateRange } from './DateRange';

/** Entity: one booking of one room. */
export class Booking {
  private status: 'active' | 'cancelled' = 'active';

  constructor(readonly id: string, readonly roomId: string, readonly stay: DateRange) {}

  isActive(): boolean {
    return this.status === 'active';
  }

  cancel(): void {
    if (this.status === 'cancelled') throw new Error('Booking already cancelled');
    this.status = 'cancelled';
  }
}
