import { Payment } from "../domain/payment/Payment";

export interface PaymentRepository {
  add(payment: Payment): void;
  save(payment: Payment): void;
  findById(id: string): Payment | undefined;
  existsForTicket(ticketCode: string): boolean;
}
