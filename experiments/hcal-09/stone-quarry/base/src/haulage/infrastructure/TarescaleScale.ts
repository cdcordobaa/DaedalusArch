import { TarescaleClient, TarescaleError } from 'tarescale-sdk';
import { ScalePort, ScaleReading, ScaleUnavailableError } from '../application/ports/ScalePort';

export class TarescaleScale implements ScalePort {
  private readonly client: TarescaleClient;

  constructor(siteId: string) {
    this.client = new TarescaleClient({ site_id: siteId });
  }

  async weigh(plate: string): Promise<ScaleReading> {
    try {
      const ticket = await this.client.weigh(plate);
      if (ticket.status !== 'STABLE') throw new ScaleUnavailableError(`scale not stable for ${plate}: ${ticket.status}`);
      return { ticketNo: ticket.ticket_no, netTonnes: (ticket.gross_kg - ticket.tare_kg) / 1000 };
    } catch (e) {
      if (e instanceof TarescaleError) throw new ScaleUnavailableError(`weighbridge offline: ${e.message}`);
      throw e;
    }
  }
}
