import { Ticket } from "../domain/ticket/Ticket";
import type { InMemoryTransaction } from "../infrastructure/InMemoryTransaction";

export interface TicketExporter {
  exportTicket(ticket: Ticket, tx: InMemoryTransaction): void;
}
