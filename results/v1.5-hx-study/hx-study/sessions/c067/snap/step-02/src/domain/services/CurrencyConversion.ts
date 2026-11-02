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

  /** Euro cents times the mid rate, rounded to two decimals, halves up (exact decimal arithmetic). */
  convert(euroCents: number, rate: ExchangeRate): Price {
    let text = rate.mid.toString();
    if (/e/i.test(text)) text = rate.mid.toFixed(20);
    const [whole, fraction = ''] = text.split('.');
    const scale = 10n ** BigInt(fraction.length);
    const mid = BigInt(whole + fraction);
    const cents = (BigInt(euroCents) * mid + scale / 2n) / scale;
    return { currency: rate.currency, amount: Number(cents) / 100 };
  }
}
