import type { QuoteLine, QuoteLineView } from '../ports/in/QuoteLine';
import type { CoverQuotes } from '../ports/out/CoverQuotes';

export class QuoteLineService implements QuoteLine {
  constructor(private readonly quotes: CoverQuotes) {}

  async line(quoteRef: string): Promise<QuoteLineView> {
    const q = await this.quotes.find(quoteRef);
    return { quoteRef, line: 'Quote ' + q.quoteRef + ': ' + q.premium.toFixed(2) + ' GBP cover (' + q.insurerState + ')' };
  }
}
