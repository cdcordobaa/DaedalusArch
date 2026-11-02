/** Rounds converted prices the way each currency is written. */
export function roundPrice(value: number, currency: string, decimals: number): number {
  // Swiss francs go to the nearest 0.05 (20 steps per franc); others to 10^-decimals.
  const stepsPerUnit = currency === 'CHF' ? 20 : Math.pow(10, decimals);
  // Trim binary floating-point noise so exact halves round up.
  const scaled = Number((value * stepsPerUnit).toPrecision(12));
  const steps = Math.max(1, Math.floor(scaled + 0.5));
  return Number((steps / stepsPerUnit).toFixed(Math.max(decimals, 2)));
}
