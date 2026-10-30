export interface CheckupRequest {
  readonly patientId: string;
  readonly slotId: string;
  /** The day the slot is on, as YYYY-MM-DD. */
  readonly day: string;
}

export interface AppointmentView {
  readonly status: string;
  readonly reservationId?: string;
  readonly slotId?: string;
  /** With status 'taken': 'SLOT_TAKEN'. */
  readonly code?: string;
  /** With status 'taken': start time of the first free slot left that day, null when the day is full. */
  readonly suggestion?: string | null;
}

export interface SlotView {
  readonly slotId: string;
  readonly startsAt: string;
  readonly minutes: number;
}

export interface BookCheckup {
  freeSlots(day: string): Promise<SlotView[]>;
  book(request: CheckupRequest): Promise<AppointmentView>;
}
