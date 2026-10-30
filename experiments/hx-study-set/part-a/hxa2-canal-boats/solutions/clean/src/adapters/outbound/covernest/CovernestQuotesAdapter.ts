import type { CovernestClient, CovernestQuoteState } from 'covernest-sdk';
import type { CoverQuote } from '../../../domain/model/CoverQuote';
import type { CoverStanding } from '../../../domain/model/CoverStanding';
import type { CoverQuotes } from '../../../application/ports/out/CoverQuotes';

export class CovernestQuotesAdapter implements CoverQuotes {
  constructor(private readonly client: CovernestClient) {}

  async find(quoteRef: string): Promise<CoverQuote> {
    const q = await this.client.fetchQuote(quoteRef);
    return { quoteRef: q.quoteRef, premium: q.premiumPence / 100, insurerState: q.state, standing: standingOf(q.state) };
  }
}

function standingOf(state: CovernestQuoteState): CoverStanding {
  switch (state) {
    case 'BOUND': return 'covered';
    case 'REFERRED': return 'in_review';
    default: return 'uncovered';
  }
}
