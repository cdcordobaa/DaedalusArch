export class StripeGateway {
  charge(cents: number): boolean {
    return cents > 0;
  }
}
