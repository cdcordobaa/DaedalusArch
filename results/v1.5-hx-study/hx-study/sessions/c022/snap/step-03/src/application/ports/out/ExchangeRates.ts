/** A usable EUR -> target rate and the time (ms since epoch) it was fixed. */
export interface UsableRate {
  readonly mid: number;
  readonly asOf: number;
  /** Decimals the target currency is written with, as given by Ratewise with the rate. */
  readonly decimals: number;
}

/** `unavailable` means Ratewise did not answer; `rate` is null when its answer had no usable rate. */
export type RateAnswer =
  | { readonly unavailable: true }
  | { readonly unavailable: false; readonly rate: UsableRate | null };

export interface ExchangeRates {
  eurTo(currency: string): Promise<RateAnswer>;
}
