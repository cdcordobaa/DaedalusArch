import type { StripeCharge } from "stripe-sdk";

export interface ChargeGateway {
  charge(payoutId: string, cents: number): StripeCharge;
}
