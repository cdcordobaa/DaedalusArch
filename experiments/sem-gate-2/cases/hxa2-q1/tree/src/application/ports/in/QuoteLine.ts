export interface QuoteLineView {
  readonly quoteRef: string;
  readonly line: string;
}

export interface QuoteLine {
  line(quoteRef: string): Promise<QuoteLineView>;
}
