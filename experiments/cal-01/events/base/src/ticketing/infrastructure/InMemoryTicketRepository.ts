import { Ticket } from "../domain/ticket/Ticket";
import { TicketRepository } from "../application/ports";

export class InMemoryTicketRepository implements TicketRepository {
  private readonly items = new Map<string, Ticket>();

  save(ticket: Ticket): void {
    this.items.set(ticket.code, ticket);
  }

  findByCode(code: string): Ticket | undefined {
    return this.items.get(code);
  }

  findByShow(showId: string): Ticket[] {
    return [...this.items.values()].filter((t) => t.showId === showId);
  }
}
