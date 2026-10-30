import type { PolicyCheck } from '../../../domain/model/PolicyCheck';

/** The policies the insurer issued for bound quotes, in the application's own terms. */
export interface Policies {
  forQuote(quoteRef: string): Promise<PolicyCheck>;
}
