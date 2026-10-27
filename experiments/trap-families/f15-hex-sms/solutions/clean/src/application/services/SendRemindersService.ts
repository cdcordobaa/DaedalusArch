import { RecipientOptedOut } from '../../domain/errors/RecipientOptedOut';
import { RecipientUnreachable } from '../../domain/errors/RecipientUnreachable';
import { TextingThrottled } from '../../domain/errors/TextingThrottled';
import type { Appointment } from '../../domain/model/Appointment';
import { ClinicTexts } from '../../domain/services/ClinicTexts';
import { FrontDesk } from '../../domain/services/FrontDesk';
import type { ReminderLine, ReminderResult, SendReminders } from '../ports/in/SendReminders';
import type { Appointments } from '../ports/out/Appointments';
import type { OptOuts } from '../ports/out/OptOuts';
import type { TextMessages } from '../ports/out/TextMessages';

const MAX_TRIES = 3;
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export class SendRemindersService implements SendReminders {
  constructor(
    private readonly appointments: Appointments,
    private readonly texts: TextMessages,
    private readonly optOuts: OptOuts,
    private readonly wording: ClinicTexts = new ClinicTexts(),
    private readonly frontDesk: FrontDesk = new FrontDesk(),
  ) {}

  async sendFor(day: string): Promise<ReminderResult[]> {
    const results: ReminderResult[] = [];
    for (const appointment of await this.appointments.onDay(day)) {
      if (appointment.reminder !== undefined) continue;
      results.push({ appointmentId: appointment.id, status: await this.remind(appointment) });
    }
    return results;
  }

  async reportFor(day: string): Promise<ReminderLine[]> {
    const lines: ReminderLine[] = [];
    for (const a of await this.appointments.onDay(day)) {
      const delivery = a.reminder === undefined ? undefined : await this.texts.deliveryOf(a.reminder);
      const reminder = this.frontDesk.shown(delivery, await this.optOuts.has(a.phone));
      lines.push({ appointmentId: a.id, patientName: a.patientName, phone: a.phone.value, time: a.time, reminder, callPatient: this.frontDesk.mustCall(reminder) });
    }
    return lines;
  }

  private async remind(appointment: Appointment): Promise<'sent' | 'not sent' | 'opted out'> {
    if (await this.optOuts.has(appointment.phone)) return 'opted out';
    for (let attempt = 1; ; attempt += 1) {
      try {
        const sent = await this.texts.send(appointment.phone, this.wording.reminder(appointment));
        appointment.remindedBy(sent.id);
        await this.appointments.save(appointment);
        return 'sent';
      } catch (e) {
        if (e instanceof RecipientOptedOut) {
          await this.optOuts.add(appointment.phone);
          return 'opted out';
        }
        if (e instanceof RecipientUnreachable) return 'not sent';
        if (!(e instanceof TextingThrottled)) throw e;
        if (attempt === MAX_TRIES) return 'not sent';
        await wait(e.waitMs);
      }
    }
  }
}
