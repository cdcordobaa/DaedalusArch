import { TicketError } from '../errors/TicketError';

/** Who may book a timed entry online. */
export class VisitRules {
  visitors(n: number): number {
    if (!Number.isInteger(n) || n < 1) throw new TicketError('visitors must be a whole number from 1');
    if (n > 10) throw new TicketError('Groups over 10 book by phone.', 400);
    return n;
  }

  slot(raw: string): string {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) throw new TicketError('a slot is written YYYY-MM-DDTHH:MM');
    return raw;
  }
}
