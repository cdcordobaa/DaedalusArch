import type { Charge } from "stripe";
import { PaymentGateway } from "../application/PaymentGateway";

export class FakeStripeGateway implements PaymentGateway {
  async authorize(ticketCode: string, amountCents: number): Promise<Charge> {
    return { id: `ch_${ticketCode}`, amount: amountCents, paid: true };
  }
}
