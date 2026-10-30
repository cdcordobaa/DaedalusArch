export interface NewOrder {
  readonly orderNo: string;
  readonly clientId: string;
  readonly sourceLang: string;
  readonly targetLang: string;
  readonly words: number;
  readonly speed: string;
}

export interface Quote {
  readonly orderNo: string;
  readonly priceEuros: number;
}

export interface Progress {
  readonly orderNo: string;
  readonly stage: string;
}

export interface ClientPortal {
  placeOrder(order: NewOrder): Promise<Quote>;
  postToMarket(orderNo: string): Promise<{ orderNo: string; jobId: string }>;
  progress(orderNo: string): Promise<Progress>;
  jobCard(orderNo: string): Promise<string>;
}
