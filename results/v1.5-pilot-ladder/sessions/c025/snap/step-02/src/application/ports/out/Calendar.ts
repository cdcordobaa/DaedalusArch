import type { Slot } from '../../../domain/model/Slot';

export type ReserveResult =
  | { readonly taken: false; readonly reservationId: string }
  | { readonly taken: true }
  | { readonly taken: false; readonly retryIn: number };

/** The clinic's chair calendar, in the application's own terms. */
export interface Calendar {
  freeOn(day: string): Promise<Slot[]>;
  /** Reserves a slot for a patient; answers the reservation id, or that someone else took the slot. */
  reserve(slotId: string, patientId: string): Promise<ReserveResult>;
}
