import type { Slot } from '../../../domain/model/Slot';

/** The clinic's chair calendar, in the application's own terms. */
export interface Calendar {
  freeOn(day: string): Promise<Slot[]>;
  /** Reserves a slot for a patient; answers the reservation id, or that someone else got the slot first. */
  reserve(slotId: string, patientId: string): Promise<ReserveResult>;
}

export type ReserveResult =
  | { readonly taken: false; readonly reservationId: string }
  | { readonly taken: true }
  /** The calendar is overloaded; try again after this many seconds. */
  | { readonly busy: true; readonly retryIn: number };
