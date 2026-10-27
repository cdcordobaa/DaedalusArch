import { Payment } from "../domain/payment/Payment";
import { PaymentRepository } from "../application/PaymentRepository";

export class InMemoryPaymentRepository implements PaymentRepository {
  private readonly items = new Map<string, Payment>();

  add(payment: Payment): void {
    if (this.existsForTicket(payment.ticketCode)) throw new Error("ticket already has a payment");
    this.items.set(payment.id, payment);
  }

  save(payment: Payment): void {
    this.items.set(payment.id, payment);
  }

  findById(id: string): Payment | undefined {
    return this.items.get(id);
  }

  existsForTicket(ticketCode: string): boolean {
    return [...this.items.values()].some((p) => p.ticketCode === ticketCode);
  }

  count(): number {
    return this.items.size;
  }
}
