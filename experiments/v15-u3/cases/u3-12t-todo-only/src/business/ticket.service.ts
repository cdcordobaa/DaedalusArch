import { TicketRepository } from '../persistence/ticket.repository';

export class TicketService {
  constructor(private readonly repo: TicketRepository) {}

  open(title: string): string {
    if (title.trim() === '') throw new Error('a ticket needs a title');
    return this.repo.insert(title);
  }
}
