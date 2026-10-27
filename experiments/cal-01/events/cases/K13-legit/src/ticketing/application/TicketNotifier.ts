import { Ticket } from "../domain/ticket/Ticket";

export interface TicketNotifier {
  notify(ticket: Ticket, message: string): void;
}
