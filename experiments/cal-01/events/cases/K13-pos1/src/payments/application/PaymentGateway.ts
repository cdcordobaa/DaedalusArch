import type { Charge } from "stripe";

export interface PaymentGateway {
  authorize(ticketCode: string, amountCents: number): Promise<Charge>;
}
