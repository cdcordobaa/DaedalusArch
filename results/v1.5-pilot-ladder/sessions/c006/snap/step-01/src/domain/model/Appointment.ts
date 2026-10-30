/** A check-up booked for a patient. */
export interface Appointment {
  readonly reservationId: string;
  readonly patientId: string;
  readonly slotId: string;
}
