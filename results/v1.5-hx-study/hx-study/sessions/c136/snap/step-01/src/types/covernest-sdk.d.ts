// Typings of the Covernest hire-cover SDK (covernest-sdk 5.0), as shipped by the vendor. Money is in pence.
declare module 'covernest-sdk' {
  export type CovernestQuoteState = 'QUOTED' | 'REFERRED' | 'BOUND' | 'DECLINED' | 'LAPSED';
  export type CovernestPolicyState = 'IN_FORCE' | 'PENDING_DOCS' | 'VOIDED';
  export type CovernestHistoryBand = 'NO_CLAIMS' | 'ONE_CLAIM' | 'SEVERAL_CLAIMS';
  export interface CovernestQuote {
    quoteRef: string;
    state: CovernestQuoteState;
    premiumPence: number;
    excessPence: number;
    validUntil: string;
  }
  export interface CovernestPolicy {
    policyNo: string;
    quoteRef: string;
    state: CovernestPolicyState;
    missingDocs: string[];
  }
  export interface CovernestHistory {
    hirerRef: string;
    band: CovernestHistoryBand;
    lastClaimOn: string | null;
  }
  export class CovernestClient {
    constructor(options: { partnerId: string; secret: string });
    fetchQuote(quoteRef: string): Promise<CovernestQuote>;
    policyForQuote(quoteRef: string): Promise<CovernestPolicy>;
    claimsHistory(hirerRef: string): Promise<CovernestHistory>;
  }
}
