export interface SeatRequests {
  request(bookingId: string, sailingId: string, seats: number): void;
}
