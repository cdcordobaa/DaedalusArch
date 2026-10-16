import type { Appointment } from "../domain/appointment.js";
import { NotFoundError } from "../domain/errors.js";
import type { Requester } from "../domain/requester.js";
import { TimeSlot } from "../domain/time-slot.js";
import type { AppointmentNotifier } from "./appointment-notifier.js";
import type { AppointmentRepository } from "./ports/appointment-repository.js";
import type { Clock } from "./ports/clock.js";
import type { PatientRepository } from "./ports/patient-repository.js";
import type { SchedulingLock } from "./scheduling-lock.js";

export interface RescheduleAppointmentCommand {
  appointmentId: string;
  requester: Requester;
  newStart: Date;
}

export class RescheduleAppointmentUseCase {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly patients: PatientRepository,
    private readonly clock: Clock,
    private readonly notifier: AppointmentNotifier,
    private readonly lock: SchedulingLock,
  ) {}

  async execute(command: RescheduleAppointmentCommand): Promise<Appointment> {
    const newSlot = TimeSlot.startingAt(command.newStart);
    const { previous, updated } = await this.lock.run(async () => {
      const appointment = await this.appointments.findById(command.appointmentId);
      if (!appointment) throw new NotFoundError("Appointment", command.appointmentId);
      const moved = appointment.reschedule({
        requester: command.requester,
        newSlot,
        now: this.clock.now(),
        existing: await this.appointments.findBySlot(newSlot),
      });
      await this.appointments.save(moved);
      return { previous: appointment, updated: moved };
    });
    const patient = await this.patients.findById(updated.patientId);
    if (patient) {
      await this.notifier.notify(patient, updated, {
        kind: "rescheduled",
        previousStart: previous.slot.start,
      });
    }
    return updated;
  }
}
