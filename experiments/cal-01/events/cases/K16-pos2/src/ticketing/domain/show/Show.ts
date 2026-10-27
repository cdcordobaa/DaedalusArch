import { DomainEvent } from "../../../shared-kernel/DomainEvent";
import { Ticket } from "../ticket/Ticket";

export class TicketSold implements DomainEvent {
  readonly type = "TicketSold";
  constructor(readonly showId: string, readonly seatId: string, readonly occurredAt: number) {}
}

export class Show {
  private readonly soldSeats = new Set<string>();
  private readonly events: DomainEvent[] = [];
  private readonly sold: Ticket[] = [];

  private constructor(
    readonly id: string,
    readonly venueId: string,
    private readonly title: string,
    private readonly capacity: number,
    private basePriceCents: number,
    private readonly startsAt: number,
  ) {}

  static schedule(
    id: string,
    venueId: string,
    title: string,
    capacity: number,
    basePriceCents: number,
    startsAt: number,
  ): Show {
    if (capacity < 1) throw new Error("capacity must be positive");
    if (basePriceCents < 0) throw new Error("price cannot be negative");
    return new Show(id, venueId, title, capacity, basePriceCents, startsAt);
  }

  sellSeat(seatId: string, buyerId: string, ticketCode: string, now: number): Ticket {
    if (now >= this.startsAt) throw new Error("sales closed");
    if (this.soldSeats.has(seatId)) throw new Error("seat already sold");
    if (this.soldSeats.size >= this.capacity) throw new Error("show sold out");
    this.soldSeats.add(seatId);
    const ticket = Ticket.issue(ticketCode, this.id, seatId, buyerId, this.basePriceCents);
    this.events.push(new TicketSold(this.id, seatId, now));
    this.sold.push(ticket);
    return ticket;
  }

  releaseSeat(seatId: string): void {
    this.soldSeats.delete(seatId);
  }

  isSold(seatId: string): boolean {
    return this.soldSeats.has(seatId);
  }

  soldCount(): number {
    return this.soldSeats.size;
  }

  getCapacity(): number {
    return this.capacity;
  }

  getTitle(): string {
    return this.title;
  }

  getBasePriceCents(): number {
    return this.basePriceCents;
  }

  getStartsAt(): number {
    return this.startsAt;
  }

  reprice(cents: number): void {
    if (cents <= 0) throw new Error("price must be positive");
    this.basePriceCents = cents;
  }

  applyEarlyBirdDiscount(percent: number): void {
    if (percent < 0 || percent > 50) throw new Error("discount must be between 0 and 50");
    this.reprice(Math.round((this.basePriceCents * (100 - percent)) / 100));
  }

  pullEvents(): DomainEvent[] {
    const out = [...this.events];
    this.events.length = 0;
    return out;
  }
}
