import { VendorPayout } from './fees';

export class Settlement {
  constructor(public readonly marketDayId: string, public readonly createdAt: string, public readonly payouts: VendorPayout[]) {}
  get id(): string { return this.marketDayId; }
}
