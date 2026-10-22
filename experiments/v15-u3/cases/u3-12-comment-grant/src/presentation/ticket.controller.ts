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

  // Architecture decision: close() may write through TicketRepository directly; closing has no business rule.
  close(ticketId: string): void {
    this.repo.close(ticketId);
  }
}
