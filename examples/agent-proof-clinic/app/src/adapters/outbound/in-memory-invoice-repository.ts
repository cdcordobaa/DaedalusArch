import type { InvoiceRepository } from "../../application/ports/invoice-repository.js";
import type { Invoice } from "../../domain/invoice.js";

export class InMemoryInvoiceRepository implements InvoiceRepository {
  private readonly byAppointmentId = new Map<string, Invoice>();

  async addIfAbsent(invoice: Invoice): Promise<boolean> {
    if (this.byAppointmentId.has(invoice.appointmentId)) return false;
    this.byAppointmentId.set(invoice.appointmentId, invoice);
    return true;
  }

  async findByAppointmentId(appointmentId: string): Promise<Invoice | undefined> {
    return this.byAppointmentId.get(appointmentId);
  }

  async findByPatientId(patientId: string): Promise<Invoice[]> {
    return [...this.byAppointmentId.values()].filter((invoice) => invoice.patientId === patientId);
  }
}
