import { TicketView } from "./TicketView";

export interface TicketingApi {
  findTicket(code: string): TicketView | undefined;
}
