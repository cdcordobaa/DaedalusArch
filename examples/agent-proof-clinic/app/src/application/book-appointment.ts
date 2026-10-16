import { Appointment } from "../domain/appointment.js";
import { NotFoundError } from "../domain/errors.js";
import { TimeSlot } from "../domain/time-slot.js";
import type { AppointmentNotifier } from "./appointment-notifier.js";
import type { AppointmentRepository } from "./ports/appointment-repository.js";
import type { Clock } from "./ports/clock.js";
import type { DoctorRepository } from "./ports/doctor-repository.js";
import type { IdGenerator } from "./ports/id-generator.js";
import type { PatientRepository } from "./ports/patient-repository.js";
import type { SchedulingLock } from "./scheduling-lock.js";

export interface BookAppointmentCommand {
  patientId: string;
  doctorId: string;
  start: Date;
}

export class BookAppointmentUseCase {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly patients: PatientRepository,
    private readonly doctors: DoctorRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly notifier: AppointmentNotifier,
    private readonly lock: SchedulingLock,
  ) {}

  async execute(command: BookAppointmentCommand): Promise<Appointment> {
    const slot = TimeSlot.startingAt(command.start);
    const patient = await this.patients.findById(command.patientId);
    if (!patient) throw new NotFoundError("Patient", command.patientId);
    const doctor = await this.doctors.findById(command.doctorId);
    if (!doctor) throw new NotFoundError("Doctor", command.doctorId);

    const appointment = await this.lock.run(async () => {
      const booked = Appointment.book({
        id: this.ids.next(),
        patientId: patient.id,
        doctorId: doctor.id,
        slot,
        now: this.clock.now(),
        existing: await this.appointments.findBySlot(slot),
      });
      await this.appointments.save(booked);
      return booked;
    });
    await this.notifier.notify(patient, appointment, { kind: "booked" });
    return appointment;
  }
}
