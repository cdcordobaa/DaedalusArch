import { Ticket } from '../domain/ticket';

export class OpenTicket {
  run(title: string): string {
    return new Ticket(title).id;
  }
}
