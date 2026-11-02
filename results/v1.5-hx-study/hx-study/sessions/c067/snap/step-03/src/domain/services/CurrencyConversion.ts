import type { ExchangeRate } from '../model/ExchangeRate';
import type { Price } from '../model/Price';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Converts euro prices with provider rates, refusing rates that may not be used. */
export class CurrencyConversion {
  isUsable(rate: ExchangeRate, currency: string, now: Date): boolean {
    if (rate.currency !== currency) return false;
    if (rate.indicative) return false;
    if (!Number.isFinite(rate.mid) || rate.mid <= 0) return false;
    const fixed = rate.fixedAt.getTime();
    if (Number.isNaN(fixed)) return false;
    return now.getTime() - fixed <= MAX_AGE_MS;
  }

  /**
   * Euro cents times the mid rate, rounded to the currency's decimals (Swiss francs: nearest 0.05),
   * halves up (exact decimal arithmetic). Never zero: at least the smallest showable amount.
   */
  convert(euroCents: number, rate: ExchangeRate): Price {
    const isChf = rate.currency === 'CHF';
    const decimals = isChf ? 2 : rate.decimals;
    const step = isChf ? 5n : 1n;
    let text = rate.mid.toString();
    if (/e/i.test(text)) text = rate.mid.toFixed(20);
    const [whole, fraction = ''] = text.split('.');
    const scale = 10n ** BigInt(fraction.length);
    const mid = BigInt(whole + fraction);
    // value in currency units = euroCents * mid / scale / 100; counted in steps of 10^-decimals * step
    const numerator = BigInt(euroCents) * mid * 10n ** BigInt(decimals);
    const denominator = 100n * scale * step;
    let count = (2n * numerator + denominator) / (2n * denominator);
    if (count < 1n) count = 1n;
    return { currency: rate.currency, amount: Number(count * step) / 10 ** decimals };
  }
}
