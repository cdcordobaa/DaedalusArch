import { InMemoryPaymentRepository } from "../infrastructure/InMemoryPaymentRepository";

export class PaymentReportService {
  constructor(private readonly payments: InMemoryPaymentRepository) {}

  totalPayments(): number {
    return this.payments.count();
  }
}
