import type { Invoice } from "../domain/invoice.js";
import type { InvoiceRepository } from "./ports/invoice-repository.js";

/** Read-only: a patient's issued invoices, newest issued first. */
export class ListPatientInvoicesUseCase {
  constructor(private readonly invoices: InvoiceRepository) {}

  async execute(patientId: string): Promise<Invoice[]> {
    const invoices = await this.invoices.findByPatientId(patientId);
    return invoices.sort(
      (a, b) => b.issuedAt.getTime() - a.issuedAt.getTime() || b.appointmentDate.localeCompare(a.appointmentDate),
    );
  }
}
