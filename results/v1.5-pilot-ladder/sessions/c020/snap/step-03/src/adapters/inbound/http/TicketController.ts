import { TicketError } from '../../../domain/errors/TicketError';
import { SlotFullError } from '../../../domain/errors/SlotFullError';
import { BusyError } from '../../../domain/errors/BusyError';
import type { BuyTickets } from '../../../application/ports/in/BuyTickets';

export interface HttpResponse {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

/** GET /slots?day= and POST /tickets for the ticket page. Every answer is uncached. */
export class TicketController {
  constructor(private readonly tickets: BuyTickets) {}

  getSlots(day: string): Promise<HttpResponse> {
    return this.run(async () => ({ status: 200, body: await this.tickets.slotsOn(day) }));
  }

  postTicket(body: Record<string, unknown>): Promise<HttpResponse> {
    return this.run(async () => ({ status: 201, body: await this.tickets.buy(String(body.slot ?? ''), Number(body.visitors)) }));
  }

  private async run(fn: () => Promise<{ status: number; body: unknown }>): Promise<HttpResponse> {
    const headers = { 'Cache-Control': 'no-store' };
    try {
      const r = await fn();
      return { status: r.status, headers, body: r.body };
    } catch (e) {
      const status = typeof (e as { statusCode?: unknown }).statusCode === 'number' ? (e as { statusCode: number }).statusCode : 400;
      if (e instanceof BusyError) {
        return { status: 503, headers: { ...headers, 'Retry-After': String(e.retryAfterSeconds) }, body: { error: e.message } };
      }
      if (e instanceof SlotFullError) {
        return {
          status: 409,
          headers: e.nextSlot ? { ...headers, 'X-Next-Slot': e.nextSlot } : headers,
          body: { error: e.code, message: e.message },
        };
      }
      if (e instanceof TicketError) return { status: status, headers, body: { error: e.message, ...(e.field !== undefined ? { field: e.field } : {}) } };
      throw e;
    }
  }
}
