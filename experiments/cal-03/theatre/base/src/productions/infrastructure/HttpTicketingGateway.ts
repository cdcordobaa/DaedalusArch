import { TicketingGateway } from '../application/ports/TicketingGateway';

export class HttpTicketingGateway implements TicketingGateway {
  readonly sent: string[] = [];

  async announce(productionId: string, title: string, firstShowAt: number): Promise<void> {
    this.sent.push(`${productionId}|${title}|${firstShowAt}`);
  }
}
