import { createAppointmentsHandler } from "../adapters/inbound/appointments-handler.js";
import type { HttpHandler } from "../adapters/inbound/http.js";
import { createInvoicesHandler } from "../adapters/inbound/invoices-handler.js";
import { createReportsHandler } from "../adapters/inbound/reports-handler.js";
import { createRouter } from "../adapters/inbound/router.js";
import { ConsoleNotificationSender } from "../adapters/outbound/console-notification-sender.js";
import { InMemoryAppointmentRepository } from "../adapters/outbound/in-memory-appointment-repository.js";
import { InMemoryDoctorRepository } from "../adapters/outbound/in-memory-doctor-repository.js";
import { InMemoryInvoiceRepository } from "../adapters/outbound/in-memory-invoice-repository.js";
import { InMemoryPatientRepository } from "../adapters/outbound/in-memory-patient-repository.js";
import { StaticFeeSchedule } from "../adapters/outbound/static-fee-schedule.js";
import { SystemClock } from "../adapters/outbound/system-clock.js";
import { UuidIdGenerator } from "../adapters/outbound/uuid-id-generator.js";
import { AppointmentNotifier } from "../application/appointment-notifier.js";
import { BookAppointmentUseCase } from "../application/book-appointment.js";
import { CancelAppointmentUseCase } from "../application/cancel-appointment.js";
import { CompleteAppointmentUseCase } from "../application/complete-appointment.js";
import { DoctorUtilizationReportUseCase } from "../application/doctor-utilization-report.js";
import { GenerateInvoiceUseCase } from "../application/generate-invoice.js";
import { ListPatientInvoicesUseCase } from "../application/list-patient-invoices.js";
import { GetAppointmentUseCase } from "../application/get-appointment.js";
import type { Clock } from "../application/ports/clock.js";
import type { DoctorRepository } from "../application/ports/doctor-repository.js";
import type { NotificationSender } from "../application/ports/notification-sender.js";
import type { PatientRepository } from "../application/ports/patient-repository.js";
import { RescheduleAppointmentUseCase } from "../application/reschedule-appointment.js";
import { SchedulingLock } from "../application/scheduling-lock.js";

export interface App {
  handle: HttpHandler;
  patients: PatientRepository;
  doctors: DoctorRepository;
}

export interface AppOptions {
  clock?: Clock;
  /** Swap in a real email/SMS provider here. */
  notificationSender?: NotificationSender;
  /** Base consultation fee in cents per doctor specialty, e.g. { "General practice": 6000 }. */
  specialtyFeesInCents?: Record<string, number>;
  /** ISO 4217 code for invoices; defaults to EUR. */
  currency?: string;
}

export function createApp(options: AppOptions = {}): App {
  const appointments = new InMemoryAppointmentRepository();
  const patients = new InMemoryPatientRepository();
  const doctors = new InMemoryDoctorRepository();
  const clock = options.clock ?? new SystemClock();
  const notifier = new AppointmentNotifier(options.notificationSender ?? new ConsoleNotificationSender());
  const lock = new SchedulingLock();
  const invoices = new InMemoryInvoiceRepository();
  const fees = new StaticFeeSchedule(options.specialtyFeesInCents ?? {}, options.currency ?? "EUR");

  const appointmentsHandler = createAppointmentsHandler({
    book: new BookAppointmentUseCase(
      appointments,
      patients,
      doctors,
      new UuidIdGenerator(),
      clock,
      notifier,
      lock,
    ),
    get: new GetAppointmentUseCase(appointments),
    cancel: new CancelAppointmentUseCase(appointments, patients, clock, notifier, lock),
    reschedule: new RescheduleAppointmentUseCase(appointments, patients, clock, notifier, lock),
    complete: new CompleteAppointmentUseCase(appointments, clock, lock),
  });
  const reportsHandler = createReportsHandler(new DoctorUtilizationReportUseCase(appointments, doctors));
  const invoicesHandler = createInvoicesHandler({
    generate: new GenerateInvoiceUseCase(invoices, appointments, doctors, patients, fees, clock, notifier),
    listForPatient: new ListPatientInvoicesUseCase(invoices),
  });
  const handle = createRouter([
    ["/appointments", appointmentsHandler],
    ["/reports/", reportsHandler],
    ["/invoices", invoicesHandler],
  ]);

  return { handle, patients, doctors };
}
