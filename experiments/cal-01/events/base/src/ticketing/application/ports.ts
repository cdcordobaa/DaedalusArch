import { Show } from "../domain/show/Show";
import { Ticket } from "../domain/ticket/Ticket";

export interface ShowRepository {
  save(show: Show): void;
  findById(id: string): Show | undefined;
}

export interface TicketRepository {
  save(ticket: Ticket): void;
  findByCode(code: string): Ticket | undefined;
  findByShow(showId: string): Ticket[];
}
