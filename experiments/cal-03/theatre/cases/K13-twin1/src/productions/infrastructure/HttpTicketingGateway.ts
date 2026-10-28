import { AnnounceResult, TicketingGateway } from '../application/ports/TicketingGateway';

export class HttpTicketingGateway implements TicketingGateway {
  readonly sent: string[] = [];

  async announce(productionId: string, title: string, firstShowAt: number): Promise<AnnounceResult> {
    this.sent.push(`${productionId}|${title}|${firstShowAt}`);
    return { accepted: true };
  }
}
