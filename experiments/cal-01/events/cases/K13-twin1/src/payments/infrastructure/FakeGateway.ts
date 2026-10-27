import { GatewayReceipt, PaymentGateway } from "../application/PaymentGateway";

export class FakeGateway implements PaymentGateway {
  async authorize(ticketCode: string, amountCents: number): Promise<GatewayReceipt> {
    return { reference: `ref_${ticketCode}_${amountCents}`, paid: true };
  }
}
