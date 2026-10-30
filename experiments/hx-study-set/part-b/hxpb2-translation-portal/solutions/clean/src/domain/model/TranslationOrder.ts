/** A document a client wants translated. */
export interface TranslationOrder {
  readonly orderNo: string;
  readonly clientId: string;
  readonly sourceLang: string;
  readonly targetLang: string;
  readonly words: number;
  /** Express orders are done in half the time and cost more per word. */
  readonly speed: 'standard' | 'express';
  readonly priceEuros: number;
  readonly jobId?: string;
}
