import { TicketError } from '../../../domain/errors/TicketError';
import { VisitRules } from '../../../domain/services/VisitRules';
import type { BuyTickets, SlotView, TicketView } from '../../ports/in/BuyTickets';
import type { Entries } from '../../ports/out/capacity/Entries';

export class BuyTicketsService implements BuyTickets {
  constructor(
    private readonly entries: Entries,
    private readonly rules: VisitRules = new VisitRules(),
  ) {}

  async slotsOn(day: string): Promise<SlotView[]> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new TicketError('a day is written YYYY-MM-DD', 'day');
    return (await this.entries.slotsOn(day)).map((s) => ({ slot: s.slot, spacesLeft: s.spacesLeft }));
  }

  async buy(rawSlot: string, rawVisitors: number): Promise<TicketView> {
    const slot = this.rules.slot(rawSlot);
    const visitors = this.rules.visitors(rawVisitors);
    let holdId: string;
    try {
      holdId = await this.entries.hold(slot, visitors);
    } catch (e) {
      if (e instanceof TicketError && e.statusCode === 409) throw new TicketError('This time slot is full.', undefined, 409, e.headers['x-next-slot'] !== undefined ? { 'X-Next-Slot': e.headers['x-next-slot'] } : {});
      if (e instanceof TicketError && e.statusCode === 429) throw new TicketError('Please try again in a moment.', undefined, 503, { 'Retry-After': e.headers['retry-after'] ?? '30' });
      throw e;
    }
    return { ticket: holdId, slot, visitors, price: visitors * 15 };
  }
}
