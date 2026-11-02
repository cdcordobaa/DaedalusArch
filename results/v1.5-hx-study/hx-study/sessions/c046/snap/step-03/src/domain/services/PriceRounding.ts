/** Rounds converted prices the way each currency is written. */
export class PriceRounding {
  /**
   * @param euroCents the product price in euro cents
   * @param mid euro-to-currency rate
   * @param decimals decimals the rate provider gives for the currency
   * Halves round up; the result is never zero (it is the smallest showable amount instead).
   */
  round(currency: string, euroCents: number, mid: number, decimals: number): number {
    const digits = Number.isInteger(decimals) && decimals >= 0 && decimals <= 8 ? decimals : 2;
    // Swiss francs go by 0.05, expressed as 5 hundredths.
    const scale = currency === 'CHF' ? 100 : 10 ** digits;
    const step = currency === 'CHF' ? 5 : 1;
    // toPrecision strips binary floating-point noise before rounding.
    const exact = Number(((euroCents * mid * scale) / 100 / step).toPrecision(12));
    const units = Math.max(1, Math.round(exact));
    return (units * step) / scale;
  }
}
