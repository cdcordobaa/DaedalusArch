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
  /** With status 'taken': the reason, 'SLOT_TAKEN'. With status 'try_later': 'RATE_LIMITED'. */
  readonly code?: string;
  /** With status 'taken': start of the first free slot left that day, null when the day is full. */
  readonly suggestion?: string | null;
  /** With status 'try_later': seconds Slotbook asks us to wait before booking again. */
  readonly retryIn?: number;
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
