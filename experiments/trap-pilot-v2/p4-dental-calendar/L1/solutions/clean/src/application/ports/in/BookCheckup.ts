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
  /** The start of the next free slot that day, or null. */
  readonly suggestion?: string | null;
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
