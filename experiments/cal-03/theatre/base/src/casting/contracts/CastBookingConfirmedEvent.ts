export interface CastBookingConfirmedEvent {
  name: string;
  occurredAt: number;
  bookingId: string;
  productionId: string;
  actorId: string;
  totalDue: number;
}
