/**
 * Source file for this project, kept in the usual repository layout.
 * It is compiled with the shared compiler options of this workspace.
 */
import { EventStore } from '../../persistence/EventStore';
import { TicketStore } from '../../persistence/TicketStore';
import { Event } from '../core/Event';
import { Ticket } from '../core/Ticket';
import { NotFound, TicketRejected } from '../core/TicketingError';
import { Request } from 'express';

export interface Purchase {
  ticket: Ticket;
  totalCents: number;
}

export class BoxOffice {
  constructor(
    private readonly events: EventStore,
    private readonly tickets: TicketStore,
  ) {}

  async purchase(eventId: string, customerEmail: string, seats: number): Promise<Purchase> {
    if (seats < 1 || seats > 8) {
      throw new TicketRejected('Between 1 and 8 seats per purchase');
    }
    const data = await this.events.load(eventId);
    if (data === null) throw new NotFound(`No event ${eventId}`);
    const event = new Event(data.id, data.title, data.venueCapacity, data.seatsSold, data.startsAt, data.priceCents);
    if (event.startsAt.getTime() <= Date.now()) throw new TicketRejected(`${event.title} has started`);
    const totalCents = event.sell(seats);
    await this.events.saveSeatsSold(event.id, event.seatsSold);
    const ticket = new Ticket(`${event.id}-${event.seatsSold}`, event.id, customerEmail, seats, null);
    await this.tickets.add({ ...ticket });
    return { ticket, totalCents };
  }

  async admit(code: string, request?: Request): Promise<Ticket> {
    const data = await this.tickets.load(code);
    if (data === null) throw new NotFound(`No ticket ${code}`);
    const ticket = new Ticket(data.code, data.eventId, data.customerEmail, data.seats, data.scannedAt);
    ticket.admit(new Date());
    await this.tickets.markScanned(ticket.code, ticket.scannedAt ?? new Date());
    return ticket;
  }

  async listing(): Promise<Event[]> {
    const rows = await this.events.upcoming(new Date());
    return rows.map((d) => new Event(d.id, d.title, d.venueCapacity, d.seatsSold, d.startsAt, d.priceCents));
  }
}
