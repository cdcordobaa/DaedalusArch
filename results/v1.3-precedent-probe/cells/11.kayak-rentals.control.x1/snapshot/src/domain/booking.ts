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
  lateFee?: { readonly amountCents: number; readonly paymentId: string };
}

export function overlaps(a: Pick<Booking, 'startsAt' | 'endsAt'>, b: Pick<Booking, 'startsAt' | 'endsAt'>): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

export function isActive(booking: Booking): boolean {
  return booking.status === 'booked' || booking.status === 'out';
}

const HALF_HOUR_MS = 30 * 60 * 1000;
export const LATE_FEE_PER_STARTED_HALF_HOUR_CENTS = 500;

export function lateFeeFor(booking: Pick<Booking, 'endsAt'>, returnedAt: Date): number {
  const late = returnedAt.getTime() - booking.endsAt.getTime();
  return late > 0 ? Math.ceil(late / HALF_HOUR_MS) * LATE_FEE_PER_STARTED_HALF_HOUR_CENTS : 0;
}
