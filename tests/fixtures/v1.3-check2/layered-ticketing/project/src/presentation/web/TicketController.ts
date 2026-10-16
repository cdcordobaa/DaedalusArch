import { BoxOffice } from '../../business/logic/BoxOffice';
import { GateLog } from '../../business/logic/GateLog';
import { euros } from '../render/money';

export interface BuyBody {
  eventId: string;
  email: string;
  seats: number;
}

export interface ScanBody {
  code: string;
  gate: string;
}

export class TicketController {
  constructor(
    private readonly boxOffice: BoxOffice,
    private readonly gates: GateLog,
  ) {}

  async buy(body: BuyBody): Promise<{ code: string; total: string }> {
    const result = await this.boxOffice.purchase(body.eventId, body.email, body.seats);
    return { code: result.ticket.code, total: euros(result.totalCents) };
  }

  async scan(body: ScanBody): Promise<{ admitted: string }> {
    const ticket = await this.boxOffice.admit(body.code);
    await this.gates.scanned(ticket.code, body.gate);
    return { admitted: ticket.code };
  }

  async events(): Promise<{ id: string; title: string; left: number; price: string }[]> {
    return (await this.boxOffice.listing()).map((e) => ({ id: e.id, title: e.title, left: e.remaining(), price: euros(e.priceCents) }));
  }
}
