import { PitchSize } from './pitch';

export class FeeTable {
  constructor(
    public stallFees: Record<PitchSize, number> = { S: 15, M: 25, L: 40 },
    public powerSurcharge = 8,
    public defaultCommission = 0.05,
    public vendorCommission: Record<string, number> = {},
  ) {}

  commissionFor(vendorId: string): number { return this.vendorCommission[vendorId] ?? this.defaultCommission; }
  stallFee(size: PitchSize, power: boolean): number { return this.stallFees[size] + (power ? this.powerSurcharge : 0); }
}

export interface VendorPayout {
  vendorId: string;
  cardSales: number;
  commission: number;
  stallFee: number;
  previousBalance: number;
  payout: number;
  stillOwed: number;
}

export function payoutFor(vendorId: string, cardSales: number, rate: number, stallFee: number, previousBalance: number): VendorPayout {
  const commission = +(cardSales * rate).toFixed(2);
  const net = +(cardSales - commission - stallFee - previousBalance).toFixed(2);
  return { vendorId, cardSales, commission, stallFee, previousBalance, payout: net > 0 ? net : 0, stillOwed: net < 0 ? -net : 0 };
}
