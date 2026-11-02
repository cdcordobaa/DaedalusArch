import type { CovernestClient } from 'covernest-sdk';
import type { CoverQuote, CoverStatus } from '../../../domain/model/CoverQuote';
import type { CoverQuotes } from '../../../application/ports/out/CoverQuotes';

export class CovernestQuotesAdapter implements CoverQuotes {
  constructor(private readonly client: CovernestClient) {}

  async find(quoteRef: string): Promise<CoverQuote> {
    const q = await this.client.fetchQuote(quoteRef);
    return { quoteRef: q.quoteRef, premium: q.premiumPence / 100, insurerState: q.state, cover: coverOf(q.state) };
  }
}

function coverOf(state: string): CoverStatus {
  if (state === 'BOUND') return 'bound';
  if (state === 'REFERRED') return 'in_review';
  return 'none';
}
