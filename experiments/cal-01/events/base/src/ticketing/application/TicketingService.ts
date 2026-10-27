import { Show } from "../domain/show/Show";
import { Ticket } from "../domain/ticket/Ticket";
import { TicketView } from "../contracts/TicketView";
import { ShowRepository, TicketRepository } from "./ports";

export class TicketingService {
  private nextCode = 1;

  constructor(
    private readonly shows: ShowRepository,
    private readonly tickets: TicketRepository,
  ) {}

  scheduleShow(
    id: string,
    venueId: string,
    title: string,
    capacity: number,
    basePriceCents: number,
    startsAt: number,
  ): void {
    this.shows.save(Show.schedule(id, venueId, title, capacity, basePriceCents, startsAt));
  }

  sellSeat(showId: string, seatId: string, buyerId: string, now: number): TicketView {
    const show = this.requireShow(showId);
    const ticket = show.sellSeat(seatId, buyerId, `T-${this.nextCode++}`, now);
    this.shows.save(show);
    this.tickets.save(ticket);
    return this.toView(ticket);
  }

  refundTicket(code: string): TicketView {
    const ticket = this.requireTicket(code);
    const show = this.requireShow(ticket.showId);
    ticket.refund();
    show.releaseSeat(ticket.seatId);
    this.tickets.save(ticket);
    this.shows.save(show);
    return this.toView(ticket);
  }

  private requireShow(id: string): Show {
    const show = this.shows.findById(id);
    if (show === undefined) throw new Error(`unknown show ${id}`);
    return show;
  }

  private requireTicket(code: string): Ticket {
    const ticket = this.tickets.findByCode(code);
    if (ticket === undefined) throw new Error(`unknown ticket ${code}`);
    return ticket;
  }

  private toView(ticket: Ticket): TicketView {
    return {
      code: ticket.code,
      showId: ticket.showId,
      seatId: ticket.seatId,
      status: ticket.getStatus(),
      priceCents: ticket.getPriceCents(),
    };
  }
}
