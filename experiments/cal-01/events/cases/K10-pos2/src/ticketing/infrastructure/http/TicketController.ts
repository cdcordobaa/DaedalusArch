import { TicketingService } from "../../application/TicketingService";
import { ShowRepository } from "../../application/ports";

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
  constructor(
    private readonly service: TicketingService,
    private readonly shows: ShowRepository,
  ) {}

  postSale(req: SaleRequest): HttpResult {
    const show = this.shows.findById(req.showId);
    if (show !== undefined && show.isSold(req.seatId)) {
      return { status: 409, body: { error: "seat already sold" } };
    }
    return { status: 201, body: this.service.sellSeat(req.showId, req.seatId, req.buyerId, req.now) };
  }
}
