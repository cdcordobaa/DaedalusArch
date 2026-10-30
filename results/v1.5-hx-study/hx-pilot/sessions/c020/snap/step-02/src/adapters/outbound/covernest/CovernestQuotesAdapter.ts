import type { CovernestClient } from 'covernest-sdk';
import type { CoverQuote } from '../../../domain/model/CoverQuote';
import type { CoverQuotes } from '../../../application/ports/out/CoverQuotes';

export class CovernestQuotesAdapter implements CoverQuotes {
  constructor(private readonly client: CovernestClient) {}

  async find(quoteRef: string): Promise<CoverQuote> {
    const q = await this.client.fetchQuote(quoteRef);
    return { quoteRef: q.quoteRef, premium: q.premiumPence / 100, insurerState: q.state, cover: q.state === 'BOUND' ? 'bound' : q.state === 'REFERRED' ? 'in_review' : 'none' };
  }
}
