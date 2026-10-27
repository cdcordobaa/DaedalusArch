import type { StripeCharge } from "stripe-sdk";
import { ChargeGateway, ChargeReceipt } from "../application/ChargeGateway";

export class StripeChargeGateway implements ChargeGateway {
  charge(payoutId: string, cents: number): ChargeReceipt {
    const raw: StripeCharge = { id: `ch-${payoutId}`, amount: cents, status: "succeeded" };
    return { id: raw.id, cents: raw.amount, accepted: raw.status === "succeeded" };
  }
}
