import type { Appointment } from "../domain/appointment.js";
import { NotFoundError } from "../domain/errors.js";
import type { Requester } from "../domain/requester.js";
import type { AppointmentRepository } from "./ports/appointment-repository.js";
import type { Clock } from "./ports/clock.js";
import type { SchedulingLock } from "./scheduling-lock.js";

export interface CompleteAppointmentCommand {
  appointmentId: string;
  requester: Requester;
}

export class CompleteAppointmentUseCase {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly clock: Clock,
    private readonly lock: SchedulingLock,
  ) {}

  execute(command: CompleteAppointmentCommand): Promise<Appointment> {
    return this.lock.run(async () => {
      const appointment = await this.appointments.findById(command.appointmentId);
      if (!appointment) throw new NotFoundError("Appointment", command.appointmentId);
      const completed = appointment.complete({ requester: command.requester, now: this.clock.now() });
      await this.appointments.save(completed);
      return completed;
    });
  }
}
