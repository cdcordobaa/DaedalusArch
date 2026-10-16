import { TicketRejected } from './TicketingError';

export class Ticket {
  code: string;
  eventId: string;
  customerEmail: string;
  seats: number;
  scannedAt: Date | null;

  constructor(code: string, eventId: string, customerEmail: string, seats: number, scannedAt: Date | null) {
    this.code = code;
    this.eventId = eventId;
    this.customerEmail = customerEmail;
    this.seats = seats;
    this.scannedAt = scannedAt;
  }

  admit(at: Date): void {
    if (this.scannedAt !== null) throw new TicketRejected(`Ticket ${this.code} was already used`);
    this.scannedAt = at;
  }
}
