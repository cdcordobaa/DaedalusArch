import { BookingRefused } from '../../../domain/errors/BookingRefused';
import { EveningFull } from '../../../domain/errors/EveningFull';
import { SkyClosed } from '../../../domain/errors/SkyClosed';
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
    return this.handle(200, () => this.bookings.eveningsIn(month));
  }

  createBooking(form: { evening?: unknown; adults?: unknown; children?: unknown }): Promise<WebReply> {
    return this.handle(201, () => this.bookings.book(String(form.evening ?? ''), Number(form.adults), Number(form.children ?? 0)));
  }

  private async handle(okStatus: number, work: () => Promise<unknown>): Promise<WebReply> {
    try {
      return { status: okStatus, headers: { ...BASE_HEADERS }, body: await work() };
    } catch (e) {
      if (!(e instanceof BookingRefused)) throw e;
      if (e instanceof EveningFull) return { status: 409, headers: { ...BASE_HEADERS }, body: { error: e.message } };
      if (e instanceof SkyClosed) {
        const headers = e.nextClearEvening === undefined ? { ...BASE_HEADERS } : { ...BASE_HEADERS, 'Next-Clear-Evening': e.nextClearEvening };
        return { status: 423, headers, body: { error: e.message } };
      }
      const own = (e as { statusCode?: unknown }).statusCode;
      return { status: typeof own === 'number' ? own : 400, headers: { ...BASE_HEADERS }, body: { error: e.message } };
    }
  }
}
