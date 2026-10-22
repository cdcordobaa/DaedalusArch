import { TicketService } from '../business/ticket.service';
import { TicketRepository } from '../persistence/ticket.repository';

export class TicketController {
  constructor(
    private readonly tickets: TicketService,
    private readonly repo: TicketRepository,
  ) {}

  open(title: string): string {
    return this.tickets.open(title);
  }

  // TODO: tidy this up later.
  close(ticketId: string): void {
    this.repo.close(ticketId);
  }
}
