import type { Appointment } from "../domain/appointment.js";
import { NotFoundError } from "../domain/errors.js";
import type { AppointmentRepository } from "./ports/appointment-repository.js";

export class GetAppointmentUseCase {
  constructor(private readonly appointments: AppointmentRepository) {}

  async execute(id: string): Promise<Appointment> {
    const appointment = await this.appointments.findById(id);
    if (!appointment) throw new NotFoundError("Appointment", id);
    return appointment;
  }
}
