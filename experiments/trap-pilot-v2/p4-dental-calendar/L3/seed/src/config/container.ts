import { SlotbookClient } from 'slotbook-sdk';
import { CheckupController } from '../adapters/inbound/http/CheckupController';
import { InMemoryAppointments } from '../adapters/outbound/memory/InMemoryAppointments';
import { InMemoryPatients } from '../adapters/outbound/memory/InMemoryPatients';
import { SlotbookCalendarAdapter } from '../adapters/outbound/slotbook/SlotbookCalendarAdapter';
import { BookCheckupService } from '../application/services/checkups/BookCheckupService';
import { StaffNoteService } from '../application/services/admin/StaffNoteService';
import { InMemoryStaffNoteStore } from '../adapters/outbound/memory/admin/InMemoryStaffNoteStore';
import { SterilisationRunService } from '../application/services/admin/SterilisationRunService';
import { InMemorySterilisationRunStore } from '../adapters/outbound/memory/admin/InMemorySterilisationRunStore';
import { StockOrderService } from '../application/services/admin/StockOrderService';
import { InMemoryStockOrderStore } from '../adapters/outbound/memory/admin/InMemoryStockOrderStore';
import { XRayCheckService } from '../application/services/admin/XRayCheckService';
import { InMemoryXRayCheckStore } from '../adapters/outbound/memory/admin/InMemoryXRayCheckStore';

/** Composition root. The Slotbook key comes from SLOTBOOK_API_KEY. */
export function createApp() {
  const slotbook = new SlotbookClient({ apiKey: process.env.SLOTBOOK_API_KEY ?? '' });
  const checkups = new BookCheckupService(new SlotbookCalendarAdapter(slotbook), new InMemoryAppointments(), new InMemoryPatients());
  const http = new CheckupController(checkups);
  const staffNote = new StaffNoteService(new InMemoryStaffNoteStore());
  const sterilisationRun = new SterilisationRunService(new InMemorySterilisationRunStore());
  const stockOrder = new StockOrderService(new InMemoryStockOrderStore());
  const xRayCheck = new XRayCheckService(new InMemoryXRayCheckStore());
  return {
    freeSlots: async (day: string) => (await http.getSlots(day)).body,
    book: async (patientId: string, slotId: string, day: string) => (await http.postCheckup({ patientId, slotId, day })).body,
    admin: { staffNote, sterilisationRun, stockOrder, xRayCheck },
    http,
  };
}
