/** NEAR-MISS N3: a function exercised by a call from a test. */
export function priceWithTax(cents: number): number {
  return Math.round(cents * 1.2);
}
