import type { CoverQuote } from '../../../domain/model/CoverQuote';

export interface CoverQuotes {
  find(quoteRef: string): Promise<CoverQuote>;
  policy(quoteRef: string): Promise<{ policyNo: string; insurerState: string; missing: string[] }>;
}
