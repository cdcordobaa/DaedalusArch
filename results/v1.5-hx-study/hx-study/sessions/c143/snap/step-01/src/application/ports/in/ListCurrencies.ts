export interface CurrencyView {
  readonly code: string;
  readonly name: string;
  readonly decimals: number;
}

export interface ListCurrencies {
  offered(): Promise<CurrencyView[]>;
}
