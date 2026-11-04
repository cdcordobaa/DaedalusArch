/** Bronze to order for one bell: the bell's weight, 12 % lost in the pour, and 40 kg for the runner and sprue. */
export function metalRequiredKg(bellWeightKg: number): number {
  return Math.ceil(bellWeightKg * 1.12 + 40);
}

/** A bell's strike note is accepted when it is within 8 cents of the target note. */
export function acceptsTuning(centsOff: number): boolean {
  return Math.abs(centsOff) <= 8;
}
