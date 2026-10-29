import { SlotbookError, type SlotbookClient } from 'slotbook-sdk';
import type { Slot } from '../../../domain/model/Slot';
import { CalendarError } from '../../../domain/errors/CalendarError';
import type { Calendar } from '../../../application/ports/out/Calendar';

export class SlotbookCalendarAdapter implements Calendar {
  constructor(private readonly client: SlotbookClient) {}

  async freeOn(day: string): Promise<Slot[]> {
    const slots = await this.client.freeSlots({ from: day + 'T00:00', to: day + 'T23:59' });
    return slots.map((s) => ({ slotId: s.slotId, startsAt: s.startsAt, minutes: s.durationMin })).sort((x, y) => x.startsAt.localeCompare(y.startsAt));
  }

  async reserve(slotId: string, patientId: string): Promise<string> {
    try {
      return (await this.client.reserve({ slotId, patientRef: patientId })).reservationId;
    } catch (e) {
      if (e instanceof SlotbookError) throw new CalendarError(e.code, e.retryAfterSec);
      throw e;
    }
  }
}
