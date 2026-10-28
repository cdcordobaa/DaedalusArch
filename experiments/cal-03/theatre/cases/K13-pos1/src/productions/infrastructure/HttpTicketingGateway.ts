import { TicketingGateway } from '../application/ports/TicketingGateway';

export interface HttpResponse {
  status: number;
  body: string;
}

export class HttpTicketingGateway implements TicketingGateway {
  readonly sent: string[] = [];

  async announce(productionId: string, title: string, firstShowAt: number): Promise<HttpResponse> {
    this.sent.push(`${productionId}|${title}|${firstShowAt}`);
    return { status: 202, body: 'queued' };
  }
}
