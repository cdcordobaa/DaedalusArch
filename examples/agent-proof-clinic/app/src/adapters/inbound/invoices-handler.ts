import type { GenerateInvoiceUseCase } from "../../application/generate-invoice.js";
import type { ListPatientInvoicesUseCase } from "../../application/list-patient-invoices.js";
import type { Invoice } from "../../domain/invoice.js";
import { formatAmount } from "../../domain/money.js";
import { csvResponse, toCsv } from "./csv.js";
import { routeNotFound, toErrorResponse } from "./error-responses.js";
import type { HttpHandler, HttpRequest, HttpResponse } from "./http.js";

export interface InvoiceUseCases {
  generate: GenerateInvoiceUseCase;
  listForPatient: ListPatientInvoicesUseCase;
}

const INVOICE_PATH = /^\/invoices\/([^/]+?)(\.csv)?$/;

export function createInvoicesHandler(useCases: InvoiceUseCases): HttpHandler {
  return async (request: HttpRequest): Promise<HttpResponse> => {
    if (request.method !== "GET") return routeNotFound();
    const url = new URL(request.path, "http://localhost");
    try {
      if (url.pathname === "/invoices") {
        const patientId = url.searchParams.get("patientId");
        if (!patientId) return { status: 400, body: { error: "patientId query parameter is required" } };
        const invoices = await useCases.listForPatient.execute(patientId);
        return { status: 200, body: { patientId, invoices: invoices.map(toSummaryDto) } };
      }
      const match = INVOICE_PATH.exec(url.pathname);
      if (!match) return routeNotFound();
      const invoice = await useCases.generate.execute(decodeURIComponent(match[1]!));
      return match[2] ? csvResponse(invoiceCsv(invoice)) : { status: 200, body: toDto(invoice) };
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

function toSummaryDto(invoice: Invoice) {
  return {
    id: invoice.id,
    appointmentId: invoice.appointmentId,
    appointmentDate: invoice.appointmentDate,
    total: formatAmount(invoice.total),
    currency: invoice.total.currency,
  };
}

function toDto(invoice: Invoice) {
  return {
    id: invoice.id,
    appointmentId: invoice.appointmentId,
    appointmentDate: invoice.appointmentDate,
    patientId: invoice.patientId,
    doctorId: invoice.doctorId,
    doctorName: invoice.doctorName,
    specialty: invoice.specialty,
    lines: invoice.lines.map((line) => ({
      description: line.description,
      amount: formatAmount(line.amount),
      currency: line.amount.currency,
    })),
    total: formatAmount(invoice.total),
    currency: invoice.total.currency,
    issuedAt: invoice.issuedAt.toISOString(),
  };
}

function invoiceCsv(invoice: Invoice): string {
  const prefix = [invoice.id, invoice.appointmentId, invoice.appointmentDate, invoice.patientId, invoice.doctorName];
  return toCsv(
    ["invoice_id", "appointment_id", "date", "patient_id", "doctor_name", "description", "amount", "currency"],
    [
      ...invoice.lines.map((line) => [...prefix, line.description, formatAmount(line.amount), line.amount.currency]),
      [...prefix, "TOTAL", formatAmount(invoice.total), invoice.total.currency],
    ],
  );
}

/**
 * One-line CSV export used by accounting (formerly `Invoice.asCsv()`; moved here because
 * CSV is a presentation concern and the domain may not import adapters).
 */
export function toAccountingCsv(invoice: Invoice): string {
  return toCsv(
    ["invoice", "appointment", "date", "total_cents"],
    [[invoice.id, invoice.appointmentId, invoice.appointmentDate, invoice.total.cents]],
  );
}
