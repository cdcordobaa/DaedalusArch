import { ClinicTexts } from '../../domain/services/ClinicTexts';
import type { ReminderLine, ReminderResult, SendReminders } from '../ports/in/SendReminders';
import type { Appointments } from '../ports/out/Appointments';
import type { TextMessages } from '../ports/out/TextMessages';

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
      const sent = await this.texts.send(appointment.phone, this.wording.reminder(appointment));
      appointment.remindedBy(sent.id);
      await this.appointments.save(appointment);
      results.push({ appointmentId: appointment.id, status: 'sent' });
    }
    return results;
  }

  async reportFor(day: string): Promise<ReminderLine[]> {
    return (await this.appointments.onDay(day)).map((a) => ({
      appointmentId: a.id,
      patientName: a.patientName,
      phone: a.phone.value,
      time: a.time,
      reminder: a.reminder === undefined ? 'not sent' : 'sent',
    }));
  }
}
