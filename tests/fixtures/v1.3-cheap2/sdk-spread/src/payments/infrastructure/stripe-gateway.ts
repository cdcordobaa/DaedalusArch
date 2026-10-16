import Stripe from 'stripe';

/** NEAR-MISS N1: the SDK in an infrastructure adapter. */
export class StripeGateway {
  private readonly stripe = new Stripe('sk_test');

  charge(cents: number): Promise<unknown> {
    return this.stripe.charges.create({ amount: cents });
  }
}
