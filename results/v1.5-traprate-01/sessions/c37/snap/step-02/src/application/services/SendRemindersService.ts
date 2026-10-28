import type { Appointment } from '../../domain/model/Appointment';
import type { SentText } from '../../domain/model/SentText';
import { ClinicTexts } from '../../domain/services/ClinicTexts';
import type { ReminderLine, ReminderResult, SendReminders } from '../ports/in/SendReminders';
import type { Appointments } from '../ports/out/Appointments';
import { TextThrottledError } from '../ports/out/TextMessages';
import type { TextMessages } from '../ports/out/TextMessages';

const MAX_TRIES = 3;

export class SendRemindersService implements SendReminders {
  constructor(
    private readonly appointments: Appointments,
    private readonly texts: TextMessages,
    private readonly wording: ClinicTexts = new ClinicTexts(),
  ) {}

  async sendFor(day: string): Promise<ReminderResult[]> {
    const results: ReminderResult[] = [];
    for (const appointment of await this.appointments.onDay(day)) {
      if (appointment.reminder !== undefined) continue;
      const sent = await this.sendWithRetry(appointment.phone, this.wording.reminder(appointment));
      if (sent === undefined) {
        results.push({ appointmentId: appointment.id, status: 'not sent' });
        continue;
      }
      appointment.remindedBy(sent.id);
      await this.appointments.save(appointment);
      results.push({ appointmentId: appointment.id, status: 'sent' });
    }
    return results;
  }

  /** Sends a text, waiting out throttling; undefined when still throttled after MAX_TRIES tries. */
  private async sendWithRetry(phone: Appointment['phone'], text: string): Promise<SentText | undefined> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.texts.send(phone, text);
      } catch (e) {
        if (!(e instanceof TextThrottledError)) throw e;
        if (attempt >= MAX_TRIES) return undefined;
        await new Promise((resolve) => setTimeout(resolve, e.retryAfterSeconds * 1000));
      }
    }
  }

  async reportFor(day: string): Promise<ReminderLine[]> {
    return Promise.all((await this.appointments.onDay(day)).map(async (a) => {
      const reminder = a.reminder === undefined ? 'not sent' : await this.texts.deliveryOf(a.reminder);
      return {
        appointmentId: a.id,
        patientName: a.patientName,
        phone: a.phone.value,
        time: a.time,
        reminder,
        callPatient: reminder === 'failed' || reminder === 'not sent',
      };
    }));
  }
}
