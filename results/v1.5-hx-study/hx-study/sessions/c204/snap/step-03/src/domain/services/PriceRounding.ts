/** Rounds converted prices the way each currency is written. */
export function roundPrice(value: number, currency: string, decimals: number): number {
  const scale = currency === 'CHF' ? 2 : decimals;
  const stepUnits = currency === 'CHF' ? 5 : 1; // step in units of 10^-scale
  // toPrecision strips binary floating-point noise before rounding; halves go up.
  const scaled = Number((value * 10 ** scale).toPrecision(12));
  let steps = Math.floor(scaled / stepUnits + 0.5);
  if (steps < 1) steps = 1;
  return Number(((steps * stepUnits) / 10 ** scale).toFixed(scale));
}
