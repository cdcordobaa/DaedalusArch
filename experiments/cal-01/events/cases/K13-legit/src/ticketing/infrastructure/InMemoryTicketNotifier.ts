import { Ticket } from "../domain/ticket/Ticket";
import { TicketNotifier } from "../application/TicketNotifier";

export class InMemoryTicketNotifier implements TicketNotifier {
  readonly sent: string[] = [];

  notify(ticket: Ticket, message: string): void {
    this.sent.push(`${ticket.buyerId}: ${message}`);
  }
}
