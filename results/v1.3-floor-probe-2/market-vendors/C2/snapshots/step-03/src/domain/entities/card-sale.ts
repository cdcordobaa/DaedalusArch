export type PaymentProvider = 'PayLane' | 'TillWave';

export class CardSale {
  constructor(
    public readonly id: string,
    public readonly provider: PaymentProvider,
    /** Provider-side sale id: a sale reported twice is stored once. */
    public readonly providerSaleId: string,
    public readonly vendorId: string,
    public readonly marketDayId: string,
    public readonly readerId: string,
    public readonly amount: number,
    public readonly time: string,
  ) {}
}

export interface ReaderAssignment { readerId: string; marketDayId: string; vendorId: string }

export interface MerchantAssignment { merchantId: string; vendorId: string }
