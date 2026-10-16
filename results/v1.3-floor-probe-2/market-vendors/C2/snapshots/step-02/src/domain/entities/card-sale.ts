export class CardSale {
  constructor(
    public readonly id: string,
    public readonly vendorId: string,
    public readonly marketDayId: string,
    public readonly readerId: string,
    public readonly amount: number,
    public readonly time: string,
  ) {}
}

export interface ReaderAssignment { readerId: string; marketDayId: string; vendorId: string }
