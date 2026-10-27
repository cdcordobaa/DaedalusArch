import { Ticket } from "../domain/ticket/Ticket";
import { TicketExporter } from "../application/TicketExporter";

export class InMemoryTicketExporter implements TicketExporter {
  readonly exported: string[] = [];

  exportTicket(ticket: Ticket, batchId: string): void {
    this.exported.push(`${batchId}:${ticket.code}`);
  }
}
