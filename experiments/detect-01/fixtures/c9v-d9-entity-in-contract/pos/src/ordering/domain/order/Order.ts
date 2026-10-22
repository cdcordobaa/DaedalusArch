import { OrderLine } from './OrderLine.js';

/** Aggregate root. Lines are created and changed only through Order. */
export class Order {
  private readonly lines: OrderLine[] = [];

  constructor(readonly id: string, readonly customerId: string, readonly currency: string) {}

  addLine(productId: string, grossCents: number): void {
    this.lines.push(new OrderLine(this.lines.length + 1, productId, grossCents, this.currency));
  }

  discountLine(lineNo: number, cents: number, reason: string): void {
    const line = this.lines.find((l) => l.lineNo === lineNo);
    if (!line) throw new Error(`Unknown order line ${lineNo}`);
    line.applyDiscount(cents, reason);
  }

  allLines(): readonly OrderLine[] {
    return this.lines;
  }
}
