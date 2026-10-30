import { TicketError } from '../../../domain/errors/TicketError';
import { OverloadedError } from '../../../domain/errors/OverloadedError';
import { SlotFullError } from '../../../domain/errors/SlotFullError';
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
      if (e instanceof OverloadedError) {
        return { status: 503, headers: { ...headers, 'Retry-After': String(e.retryAfterSeconds) }, body: { error: e.message } };
      }
      if (e instanceof SlotFullError) return { status: 409, headers, body: { error: e.message } };
      if (e instanceof TicketError) return { status: 400, headers, body: { error: e.message } };
      throw e;
    }
  }
}
