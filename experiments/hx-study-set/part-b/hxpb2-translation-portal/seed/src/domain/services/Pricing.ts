import { BureauError } from '../errors/BureauError';
import type { TranslationOrder } from '../model/TranslationOrder';

const PER_WORD = { standard: 0.12, express: 0.18 } as const;
const MINIMUM_EUROS = 25;

/** The bureau's price list and what an order must state. */
export class Pricing {
  quote(words: number, speed: TranslationOrder['speed']): number {
    if (!Number.isInteger(words) || words < 1) throw new BureauError('the word count is a whole number from 1');
    const raw = Math.round(words * PER_WORD[speed] * 100) / 100;
    return Math.max(MINIMUM_EUROS, raw);
  }

  speed(raw: string): TranslationOrder['speed'] {
    if (raw === 'standard' || raw === 'express') return raw;
    throw new BureauError('speed is standard or express');
  }

  languages(source: string, target: string): [string, string] {
    const s = source.trim().toLowerCase();
    const t = target.trim().toLowerCase();
    if (!/^[a-z]{2}$/.test(s) || !/^[a-z]{2}$/.test(t)) throw new BureauError('languages are two-letter codes');
    if (s === t) throw new BureauError('source and target languages must differ');
    return [s, t];
  }
}
