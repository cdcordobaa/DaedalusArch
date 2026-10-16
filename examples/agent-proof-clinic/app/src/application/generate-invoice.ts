import { DomainError, NotFoundError } from "../domain/errors.js";
import { Invoice } from "../domain/invoice.js";
import type { AppointmentNotifier } from "./appointment-notifier.js";
import type { AppointmentRepository } from "./ports/appointment-repository.js";
import type { Clock } from "./ports/clock.js";
import type { DoctorRepository } from "./ports/doctor-repository.js";
import type { FeeSchedule } from "./ports/fee-schedule.js";
import type { InvoiceRepository } from "./ports/invoice-repository.js";
import type { PatientRepository } from "./ports/patient-repository.js";

/**
 * Issues the invoice for an appointment on first request and returns the stored one afterwards,
 * so the patient is notified exactly once.
 */
export class GenerateInvoiceUseCase {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly appointments: AppointmentRepository,
    private readonly doctors: DoctorRepository,
    private readonly patients: PatientRepository,
    private readonly fees: FeeSchedule,
    private readonly clock: Clock,
    private readonly notifier: AppointmentNotifier,
  ) {}

  async execute(appointmentId: string): Promise<Invoice> {
    const existing = await this.invoices.findByAppointmentId(appointmentId);
    if (existing) return existing;

    const appointment = await this.appointments.findById(appointmentId);
    if (!appointment) throw new NotFoundError("Appointment", appointmentId);
    const doctor = await this.doctors.findById(appointment.doctorId);
    if (!doctor) throw new NotFoundError("Doctor", appointment.doctorId);
    const baseFee = this.fees.baseFeeFor(doctor.specialty);
    if (!baseFee) throw new DomainError(`No base fee configured for specialty "${doctor.specialty}"`);

    const invoice = Invoice.issue({ appointment, doctor, baseFee, issuedAt: this.clock.now() });
    if (!(await this.invoices.addIfAbsent(invoice))) {
      // A concurrent request issued it first; return that one and leave notifying to it.
      return (await this.invoices.findByAppointmentId(appointmentId))!;
    }
    const patient = await this.patients.findById(appointment.patientId);
    if (patient) {
      await this.notifier.notify(patient, appointment, {
        kind: "invoiced",
        invoiceId: invoice.id,
        total: invoice.total,
      });
    }
    return invoice;
  }
}
