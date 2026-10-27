export interface StockLot {
  id: string;
  binId: string;
  sku: string;
  quantity: number;
}

export class Bin {
  private lots: StockLot[] = [];
  constructor(readonly id: string, readonly capacity: number) {}
  list(): readonly StockLot[] {
    return this.lots;
  }
  used(): number {
    return this.lots.reduce((s, l) => s + l.quantity, 0);
  }
  put(lot: StockLot): void {
    this.lots.push(lot);
  }
}
