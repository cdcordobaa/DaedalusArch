import { Quote } from '../domain/quote';
import { TranslationJob } from '../domain/translation-job';
import { Translator } from '../domain/translator';

export interface QuoteView {
  readonly id: string;
  readonly pair: string;
  readonly words: number;
  readonly totalCents: number;
  readonly rush: boolean;
  readonly validUntil: string;
}

export interface JobView {
  readonly id: string;
  readonly pair: string;
  readonly words: number;
  readonly status: string;
  readonly dueAt: string;
  readonly translatorId: string | null;
}

export interface TranslatorView {
  readonly id: string;
  readonly fullName: string;
  readonly pairs: readonly string[];
  readonly centsPerWord: number;
}

export function toQuoteView(q: Quote): QuoteView {
  const validUntil = new Date(q.issuedAt.getTime() + Quote.VALID_DAYS * 24 * 60 * 60 * 1000);
  return { id: q.id, pair: q.pair, words: q.words, totalCents: q.totalCents, rush: q.rush, validUntil: validUntil.toISOString() };
}

export function toJobView(j: TranslationJob): JobView {
  return { id: j.id, pair: j.pair, words: j.words, status: j.status, dueAt: j.dueAt.toISOString(), translatorId: j.translatorId };
}

export function toTranslatorView(t: Translator): TranslatorView {
  return { id: t.id, fullName: t.fullName, pairs: t.pairs, centsPerWord: t.centsPerWord };
}
