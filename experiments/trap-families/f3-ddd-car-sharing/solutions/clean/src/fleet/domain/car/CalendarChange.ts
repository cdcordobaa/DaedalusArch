export type CalendarChangeKind = 'booked' | 'cancelled' | 'moved-in' | 'moved-out';

export interface CalendarChange {
  readonly kind: CalendarChangeKind;
  readonly bookingId: string;
  readonly otherCar: string | null;
}
