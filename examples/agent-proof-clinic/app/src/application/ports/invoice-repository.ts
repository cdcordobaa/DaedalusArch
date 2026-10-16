import type { Invoice } from "../../domain/invoice.js";

export interface InvoiceRepository {
  /** Stores the invoice unless one already exists for its appointment; returns whether it was added. */
  addIfAbsent(invoice: Invoice): Promise<boolean>;
  findByAppointmentId(appointmentId: string): Promise<Invoice | undefined>;
  findByPatientId(patientId: string): Promise<Invoice[]>;
}
