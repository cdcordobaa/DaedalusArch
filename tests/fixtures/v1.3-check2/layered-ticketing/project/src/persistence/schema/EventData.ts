export interface EventData {
  id: string;
  title: string;
  venueCapacity: number;
  seatsSold: number;
  startsAt: Date;
  priceCents: number;
}

export interface TicketData {
  code: string;
  eventId: string;
  customerEmail: string;
  seats: number;
  scannedAt: Date | null;
}
