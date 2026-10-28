import { TicketingGateway } from '../application/ports/TicketingGateway';

interface HttpResponse {
  status: number;
  body: string;
}

export class HttpTicketingGateway implements TicketingGateway {
  readonly sent: string[] = [];

  async announce(productionId: string, title: string, firstShowAt: number): Promise<void> {
    const response = await this.post('/shows', `${productionId}|${title}|${firstShowAt}`);
    if (response.status >= 400) {
      throw new Error('ticketing refused the announcement');
    }
  }

  private async post(_path: string, body: string): Promise<HttpResponse> {
    this.sent.push(body);
    return { status: 202, body: 'queued' };
  }
}
