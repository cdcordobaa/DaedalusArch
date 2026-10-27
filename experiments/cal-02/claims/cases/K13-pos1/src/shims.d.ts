declare module "stripe-sdk" {
  export interface StripeCharge {
    id: string;
    amount: number;
    status: string;
  }
}
