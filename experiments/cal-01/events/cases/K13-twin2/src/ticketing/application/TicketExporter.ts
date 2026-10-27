import { Ticket } from "../domain/ticket/Ticket";

export interface TicketExporter {
  exportTicket(ticket: Ticket, batchId: string): void;
}
