import { TextwaveClient } from 'textwave-sdk';
import { ClinicController } from '../adapters/inbound/http/ClinicController';
import { InMemoryAppointments } from '../adapters/outbound/memory/InMemoryAppointments';
import { InMemoryOptOuts } from '../adapters/outbound/memory/InMemoryOptOuts';
import { TextwaveTextMessagesAdapter } from '../adapters/outbound/textwave/TextwaveTextMessagesAdapter';
import { BookAppointmentService } from '../application/services/BookAppointmentService';
import { SendRemindersService } from '../application/services/SendRemindersService';

/** Composition root. The Textwave key comes from TEXTWAVE_API_KEY; texts are sent as NORTHSIDE. */
export function createApp() {
  const textwave = new TextwaveClient({ apiKey: process.env.TEXTWAVE_API_KEY ?? '' });
  const appointments = new InMemoryAppointments();
  const optOuts = new InMemoryOptOuts();
  const texts = new TextwaveTextMessagesAdapter(textwave, 'NORTHSIDE');
  const booking = new BookAppointmentService(appointments, texts, optOuts);
  const reminders = new SendRemindersService(appointments, texts, optOuts);
  const http = new ClinicController(booking, reminders);
  return {
    book: (patientName: string, phone: string, day: string, time: string) => booking.book({ patientName, phone, day, time }),
    sendReminders: (day: string) => reminders.sendFor(day),
    reminderReport: (day: string) => reminders.reportFor(day),
    http,
  };
}
