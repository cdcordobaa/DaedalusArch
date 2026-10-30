import type { AppointmentView, BookCheckup } from '../../../application/ports/in/BookCheckup';
import { BookingRefused } from '../../../domain/errors/BookingRefused';

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

/** GET /slots?day= and POST /checkups, for the patient app and the front desk screen. */
export class CheckupController {
  constructor(private readonly checkups: BookCheckup) {}

  getSlots(day: string): Promise<HttpResponse> {
    return this.run(() => this.checkups.freeSlots(day));
  }

  postCheckup(body: Record<string, unknown>): Promise<HttpResponse> {
    return this.run(async () => render(await this.checkups.book({ patientId: String(body.patientId ?? ''), slotId: String(body.slotId ?? ''), day: String(body.day ?? '') })));
  }

  private async run(fn: () => Promise<unknown>): Promise<HttpResponse> {
    try {
      return { status: 200, body: await fn() };
    } catch (e) {
      if (e instanceof BookingRefused) return { status: 400, body: { error: e.message, code: e.code } };
      return { status: 400, body: { error: e instanceof Error ? e.message : String(e) } };
    }
  }
}

function render(view: AppointmentView): unknown {
  return view;
}
