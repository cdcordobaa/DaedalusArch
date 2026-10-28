export interface AnnounceResult {
  accepted: boolean;
}

export interface TicketingGateway {
  announce(productionId: string, title: string, firstShowAt: number): Promise<AnnounceResult>;
}
