import { TicketingService } from "../../application/TicketingService";

export interface SaleRequest {
  readonly showId: string;
  readonly seatId: string;
  readonly buyerId: string;
  readonly now: number;
}

export interface HttpResult {
  readonly status: number;
  readonly body: unknown;
}

export class TicketController {
  constructor(private readonly service: TicketingService) {}

  postSale(req: SaleRequest): HttpResult {
    try {
      return { status: 201, body: this.service.sellSeat(req.showId, req.seatId, req.buyerId, req.now) };
    } catch (error) {
      return { status: 409, body: { error: error instanceof Error ? error.message : "conflict" } };
    }
  }
}
