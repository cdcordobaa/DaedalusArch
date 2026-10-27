import { Payment } from "../domain/payment/Payment";
import { PaymentRepository } from "./PaymentRepository";
import { Mutex } from "./Mutex";

export class PaymentService {
  private readonly captureLock = new Mutex();

  constructor(private readonly payments: PaymentRepository) {}

  charge(paymentId: string, ticketCode: string, amountCents: number): void {
    this.payments.add(Payment.create(paymentId, ticketCode, amountCents));
  }

  capture(paymentId: string): void {
    const payment = this.require(paymentId);
    payment.capture();
    this.payments.save(payment);
  }

  refund(paymentId: string): void {
    const payment = this.require(paymentId);
    payment.refund();
    this.payments.save(payment);
  }

  async captureOnce(paymentId: string): Promise<void> {
    await this.captureLock.runExclusive(async () => {
      const payment = this.require(paymentId);
      if (payment.getStatus() === "captured") return;
      payment.capture();
      this.payments.save(payment);
    });
  }

  private require(id: string): Payment {
    const payment = this.payments.findById(id);
    if (payment === undefined) throw new Error(`unknown payment ${id}`);
    return payment;
  }
}
