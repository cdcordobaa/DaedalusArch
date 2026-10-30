import type { Slot } from '../../../domain/model/Slot';

/** The clinic's chair calendar, in the application's own terms. */
export interface Calendar {
  freeOn(day: string): Promise<Slot[]>;
  /** Reserves a slot for a patient; answers the reservation id. */
  reserve(slotId: string, patientId: string): Promise<string>;
}
