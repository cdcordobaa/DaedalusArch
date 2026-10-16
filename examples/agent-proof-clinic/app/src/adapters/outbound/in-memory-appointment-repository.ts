import type { AppointmentRepository } from "../../application/ports/appointment-repository.js";
import type { Appointment } from "../../domain/appointment.js";
import type { TimeSlot } from "../../domain/time-slot.js";

export class InMemoryAppointmentRepository implements AppointmentRepository {
  private readonly byId = new Map<string, Appointment>();

  async save(appointment: Appointment): Promise<void> {
    this.byId.set(appointment.id, appointment);
  }

  async findById(id: string): Promise<Appointment | undefined> {
    return this.byId.get(id);
  }

  async findBySlot(slot: TimeSlot): Promise<Appointment[]> {
    return [...this.byId.values()].filter((a) => a.slot.equals(slot));
  }

  async findStartingBetween(from: Date, to: Date): Promise<Appointment[]> {
    return [...this.byId.values()].filter((a) => {
      const start = a.slot.start.getTime();
      return start >= from.getTime() && start < to.getTime();
    });
  }
}
