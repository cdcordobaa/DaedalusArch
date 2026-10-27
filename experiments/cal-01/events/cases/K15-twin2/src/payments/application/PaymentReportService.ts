import { PaymentRepository } from "./PaymentRepository";

export class PaymentReportService {
  constructor(private readonly payments: PaymentRepository) {}

  isPaid(ticketCode: string): boolean {
    return this.payments.existsForTicket(ticketCode);
  }
}
