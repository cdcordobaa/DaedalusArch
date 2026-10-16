import type { Appointment } from "../../domain/appointment.js";
import type { TimeSlot } from "../../domain/time-slot.js";

export interface AppointmentRepository {
  save(appointment: Appointment): Promise<void>;
  findById(id: string): Promise<Appointment | undefined>;
  findBySlot(slot: TimeSlot): Promise<Appointment[]>;
  /** Appointments (any status) whose slot starts in [from, to). */
  findStartingBetween(from: Date, to: Date): Promise<Appointment[]>;
}
