/** A bell's strike note is accepted when it is within 8 cents of the target note. */
export function acceptsTuning(centsOff: number): boolean {
  return Math.abs(centsOff) <= 8;
}
