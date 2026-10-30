import type { Wordmarket } from 'wordmarket-sdk';
import type { TranslationOrder } from '../../../domain/model/TranslationOrder';
import type { JobPosting } from '../../../application/ports/out/marketplace/JobPosting';

export class WordmarketPostingAdapter implements JobPosting {
  constructor(private readonly market: Wordmarket) {}

  async post(order: TranslationOrder, brief: string): Promise<string> {
    const job = await this.market.jobs.post({
      sourceLang: order.sourceLang,
      targetLang: order.targetLang,
      wordCount: order.words,
      turnaround: order.speed === 'express' ? 'express' : 'normal',
      brief,
    });
    return job.id;
  }
}
