import { SlotbookError, type SlotbookClient } from 'slotbook-sdk';
import type { Slot } from '../../../domain/model/Slot';
import { CalendarRefused } from '../../../domain/errors/CalendarRefused';
import type { Calendar } from '../../../application/ports/out/calendar/Calendar';

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
      if (e instanceof SlotbookError) throw new CalendarRefused(e.code);
      throw e;
    }
  }
}
