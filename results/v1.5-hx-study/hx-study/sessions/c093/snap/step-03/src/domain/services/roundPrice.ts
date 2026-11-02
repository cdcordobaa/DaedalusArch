/**
 * Rounds an amount given in hundredths of the target currency (euro-cents times the rate)
 * to the way the currency is written. Halves round up; never returns zero.
 * Swiss francs go to the nearest 0.05; other currencies to `decimals` decimals.
 */
export function roundPrice(hundredths: number, currency: string, decimals: number): number {
  const swiss = currency === 'CHF';
  const unitsRaw = swiss ? hundredths / 5 : hundredths * Math.pow(10, decimals - 2);
  // toPrecision strips binary floating-point noise so exact halves round up.
  const units = Math.max(1, Math.floor(Number(unitsRaw.toPrecision(12)) + 0.5));
  return swiss ? (units * 5) / 100 : units / Math.pow(10, decimals);
}
