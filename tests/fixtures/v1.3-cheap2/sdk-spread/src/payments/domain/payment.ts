import Stripe from 'stripe';

/** PLANTED P1: a vendor SDK in the domain. */
export class Payment {
  constructor(private readonly stripe: Stripe, readonly cents: number) {}

  charge(): Promise<unknown> {
    return this.stripe.charges.create({ amount: this.cents });
  }
}
