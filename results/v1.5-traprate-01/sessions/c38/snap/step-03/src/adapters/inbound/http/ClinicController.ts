import type { BookAppointment } from '../../../application/ports/in/BookAppointment';
import type { SendReminders } from '../../../application/ports/in/SendReminders';

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

/** POST /appointments, POST /reminders/:day and GET /reminders/:day. */
export class ClinicController {
  constructor(
    private readonly booking: BookAppointment,
    private readonly reminders: SendReminders,
  ) {}

  async postAppointment(body: Record<string, unknown>): Promise<HttpResponse> {
    return this.answer(() => this.booking.book({
      patientName: String(body.patientName ?? ''),
      phone: String(body.phone ?? ''),
      day: String(body.day ?? ''),
      time: String(body.time ?? ''),
    }));
  }

  async postReminders(day: string): Promise<HttpResponse> {
    return this.answer(() => this.reminders.sendFor(day));
  }

  async getReminders(day: string): Promise<HttpResponse> {
    return this.answer(() => this.reminders.reportFor(day));
  }

  private async answer(run: () => Promise<unknown>): Promise<HttpResponse> {
    try {
      return { status: 200, body: await run() };
    } catch (e) {
      return { status: 400, body: { error: e instanceof Error ? e.message : String(e) } };
    }
  }
}
