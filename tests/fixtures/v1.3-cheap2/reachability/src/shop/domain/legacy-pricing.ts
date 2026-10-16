/** PLANTED P3: nothing reaches this module. */
export class LegacyPricing {
  price(cents: number): number {
    return cents * 2;
  }
}
