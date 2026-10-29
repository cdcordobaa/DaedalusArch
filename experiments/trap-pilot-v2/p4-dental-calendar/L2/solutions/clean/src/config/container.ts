import { SlotbookClient } from 'slotbook-sdk';
import { CheckupController } from '../adapters/inbound/http/CheckupController';
import { InMemoryAppointments } from '../adapters/outbound/memory/InMemoryAppointments';
import { SlotbookCalendarAdapter } from '../adapters/outbound/slotbook/SlotbookCalendarAdapter';
import { BookCheckupService } from '../application/services/BookCheckupService';

/** Composition root. The Slotbook key comes from SLOTBOOK_API_KEY. */
export function createApp() {
  const slotbook = new SlotbookClient({ apiKey: process.env.SLOTBOOK_API_KEY ?? '' });
  const checkups = new BookCheckupService(new SlotbookCalendarAdapter(slotbook), new InMemoryAppointments());
  const http = new CheckupController(checkups);
  return {
    freeSlots: async (day: string) => (await http.getSlots(day)).body,
    book: async (patientId: string, slotId: string, day: string) => (await http.postCheckup({ patientId, slotId, day })).body,
    http,
  };
}
