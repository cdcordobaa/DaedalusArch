export type BookingStatus = 'booked' | 'out' | 'returned' | 'cancelled';

export interface Booking {
  readonly id: string;
  readonly kayakId: string;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  status: BookingStatus;
  depositPaymentId?: string;
  returnedAt?: Date;
}

export function overlaps(a: Pick<Booking, 'startsAt' | 'endsAt'>, b: Pick<Booking, 'startsAt' | 'endsAt'>): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

export function isActive(booking: Booking): boolean {
  return booking.status === 'booked' || booking.status === 'out';
}

export const FREE_CANCELLATION_MS = 24 * 60 * 60 * 1000;

export function canCancel(booking: Booking, now: Date): boolean {
  return booking.status === 'booked' && booking.startsAt.getTime() - now.getTime() >= FREE_CANCELLATION_MS;
}
