import { Ticket } from "../domain/ticket/Ticket";
import { TicketExporter } from "../application/TicketExporter";
import { InMemoryTransaction } from "./InMemoryTransaction";

export class InMemoryTicketExporter implements TicketExporter {
  exportTicket(ticket: Ticket, tx: InMemoryTransaction): void {
    tx.exported.push(ticket.code);
  }
}
