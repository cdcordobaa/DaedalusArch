export interface QuoteRequest {
  readonly from: string;
  readonly to: string;
  readonly weightGrams: number;
}

export interface QuoteView {
  readonly amount: number;
  readonly currency: string;
  readonly service: string;
  readonly estimated: boolean;
}

export interface QuoteShipment {
  quote(request: QuoteRequest): Promise<QuoteView>;
}
