export type CalendarChangeKind = 'reserved' | 'cancelled' | 'relocated-in' | 'relocated-out';

export interface CalendarChange {
  readonly kind: CalendarChangeKind;
  readonly reservationId: string;
  readonly otherRoom: string | null;
}
