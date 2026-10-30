export interface BookingRequest {
  readonly bookingId: string;
  readonly pitch: string;
  readonly nights: number;
  readonly paymentId: string;
}

export interface BookingView {
  readonly bookingId: string;
  readonly status: string;
  readonly pitch?: string;
  readonly nights?: number;
  readonly total?: number;
  readonly paid?: number;
  readonly reason?: string;
}

export interface BookPitch {
  book(request: BookingRequest): Promise<BookingView>;
  checkIn(bookingId: string): Promise<BookingView>;
  cancel(bookingId: string): Promise<BookingView>;
}
