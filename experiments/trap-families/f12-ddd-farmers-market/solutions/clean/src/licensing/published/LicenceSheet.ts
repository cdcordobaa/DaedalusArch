/** A vendor's licence as the rest of the market may see it. */
export interface LicenceSheet {
  readonly vendorId: string;
  readonly tradingName: string;
  readonly inspectionScore: number | null;
  readonly strikes: number;
  readonly status: 'full' | 'basic' | 'suspended';
  readonly lastTraded: string | null;
}
