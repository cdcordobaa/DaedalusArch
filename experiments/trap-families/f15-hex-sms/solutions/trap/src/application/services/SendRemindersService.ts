import { TextwaveRecipientBlockedError, TextwaveThrottledError } from 'textwave-sdk';
import { ClinicTexts } from '../../domain/services/ClinicTexts';
import type { ReminderLine, ReminderResult, SendReminders } from '../ports/in/SendReminders';
import type { Appointments } from '../ports/out/Appointments';
import type { DeliveryReportsPort } from '../ports/out/DeliveryReportsPort';
import type { TextMessages } from '../ports/out/TextMessages';

export class SendRemindersService implements SendReminders {
  constructor(
    private readonly appointments: Appointments,
    private readonly texts: TextMessages,
    private readonly reports: DeliveryReportsPort,
    private readonly wording: ClinicTexts = new ClinicTexts(),
  ) {}

  async sendFor(day: string): Promise<ReminderResult[]> {
    const results: ReminderResult[] = [];
    for (const appointment of await this.appointments.onDay(day)) {
      if (appointment.reminder !== undefined) continue;
      if (await this.appointments.isOptedOut(appointment.phone.value)) {
        results.push({ appointmentId: appointment.id, status: 'opted out' });
        continue;
      }
      let status = 'not sent';
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const sent = await this.texts.send(appointment.phone, this.wording.reminder(appointment));
          appointment.remindedBy(sent.id);
          await this.appointments.save(appointment);
          status = 'sent';
          break;
        } catch (e) {
          if (e instanceof TextwaveRecipientBlockedError) {
            if (e.blockReason === 'OPTED_OUT') {
              await this.appointments.markOptedOut(appointment.phone.value);
              status = 'opted out';
            }
            break;
          }
          if (!(e instanceof TextwaveThrottledError)) throw e;
          if (attempt < 3) await new Promise((r) => setTimeout(r, e.retryAfterSeconds * 1000));
        }
      }
      results.push({ appointmentId: appointment.id, status });
    }
    return results;
  }

  async reportFor(day: string): Promise<ReminderLine[]> {
    const lines: ReminderLine[] = [];
    for (const a of await this.appointments.onDay(day)) {
      let reminder: string;
      if (a.reminder === undefined) {
        reminder = (await this.appointments.isOptedOut(a.phone.value)) ? 'opted out' : 'not sent';
      } else {
        const report = await this.reports.reportFor(a.reminder);
        reminder = report.deliveryState === 'DELIVERED' ? 'delivered' : report.deliveryState === 'ACCEPTED' ? 'sent' : 'failed';
      }
      lines.push({ appointmentId: a.id, patientName: a.patientName, phone: a.phone.value, time: a.time, reminder, callPatient: reminder !== 'delivered' && reminder !== 'sent' });
    }
    return lines;
  }
}
