import type { Appointment } from "../domain/appointment.js";
import { NotFoundError } from "../domain/errors.js";
import type { Requester } from "../domain/requester.js";
import type { AppointmentNotifier } from "./appointment-notifier.js";
import type { AppointmentRepository } from "./ports/appointment-repository.js";
import type { Clock } from "./ports/clock.js";
import type { PatientRepository } from "./ports/patient-repository.js";
import type { SchedulingLock } from "./scheduling-lock.js";

export interface CancelAppointmentCommand {
  appointmentId: string;
  requester: Requester;
}

export class CancelAppointmentUseCase {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly patients: PatientRepository,
    private readonly clock: Clock,
    private readonly notifier: AppointmentNotifier,
    private readonly lock: SchedulingLock,
  ) {}

  async execute(command: CancelAppointmentCommand): Promise<Appointment> {
    const cancelled = await this.lock.run(async () => {
      const appointment = await this.appointments.findById(command.appointmentId);
      if (!appointment) throw new NotFoundError("Appointment", command.appointmentId);
      const updated = appointment.cancel({ requester: command.requester, now: this.clock.now() });
      await this.appointments.save(updated);
      return updated;
    });
    const patient = await this.patients.findById(cancelled.patientId);
    if (patient) await this.notifier.notify(patient, cancelled, { kind: "cancelled" });
    return cancelled;
  }
}
