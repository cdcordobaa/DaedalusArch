/** How many claims a hirer has made, in our own words. */
export type RiskBand = 'none' | 'low' | 'high';

export interface HirerView {
  readonly hirerRef: string;
  readonly band: RiskBand;
  readonly mayHire: boolean;
}

export interface CheckHirer {
  check(hirerRef: string): Promise<HirerView>;
}
