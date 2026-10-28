export interface TicketingGateway {
  announce(productionId: string, title: string, firstShowAt: number): Promise<void>;
}
