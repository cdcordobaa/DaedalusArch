import { Ticket } from "../domain/ticket/Ticket";

export interface TicketingApi {
  findTicket(code: string): Ticket | undefined;
}
