export interface ConfirmBookingParamsDto {
  bookingId: string;
}

export interface ConfirmBookingResponseDto {
  bookingId: string;
  status: string;
  error?: string;
}

export interface HttpReply<T> {
  status: number;
  body: T;
}
