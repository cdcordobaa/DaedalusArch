import type { CoverPolicy } from '../../../domain/model/CoverPolicy';

export interface CoverPolicies {
  forQuote(quoteRef: string): Promise<CoverPolicy>;
}
