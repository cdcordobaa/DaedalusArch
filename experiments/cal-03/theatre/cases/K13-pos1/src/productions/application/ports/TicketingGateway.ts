import type { HttpResponse } from '../../infrastructure/HttpTicketingGateway';

export interface TicketingGateway {
  announce(productionId: string, title: string, firstShowAt: number): Promise<HttpResponse>;
}
