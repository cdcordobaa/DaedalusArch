import { BookingRefused } from '../../../domain/errors/BookingRefused';
import { CloudedOut } from '../../../domain/errors/CloudedOut';
import { EveningFullyBooked } from '../../../domain/errors/EveningFullyBooked';
import type { BookEvenings } from '../../../application/ports/in/BookEvenings';

export interface WebReply {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
}

const BASE_HEADERS = { 'Content-Language': 'en' };

/** GET /evenings?month= and POST /bookings for the observatory's booking page. */
export class EveningController {
  constructor(private readonly bookings: BookEvenings) {}

  listMonth(month: string): Promise<WebReply> {
    return this.handle(200, async () =>
      (await this.bookings.eveningsIn(month)).map((e) => ({ evening: e.date, seatsFree: e.openSeats, telescope: e.instrument })),
    );
  }

  createBooking(form: { evening?: unknown; adults?: unknown; children?: unknown }): Promise<WebReply> {
    return this.handle(201, () => this.bookings.book(String(form.evening ?? ''), Number(form.adults), Number(form.children ?? 0)));
  }

  private async handle(okStatus: number, work: () => Promise<unknown>): Promise<WebReply> {
    try {
      return { status: okStatus, headers: { ...BASE_HEADERS }, body: await work() };
    } catch (e) {
      if (!(e instanceof BookingRefused)) throw e;
      if (e instanceof CloudedOut) {
        const headers: Record<string, string> = { ...BASE_HEADERS };
        if (e.nextClearEvening) headers['Next-Clear-Evening'] = e.nextClearEvening;
        return { status: 423, headers, body: { error: e.message } };
      }
      const own = (e as { statusCode?: unknown }).statusCode;
      const status = e instanceof EveningFullyBooked ? 409 : typeof own === 'number' ? own : 400;
      return { status, headers: { ...BASE_HEADERS }, body: { error: e.message } };
    }
  }
}
