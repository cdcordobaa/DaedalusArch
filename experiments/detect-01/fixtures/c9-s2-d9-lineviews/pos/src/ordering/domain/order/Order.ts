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

  /** Lines as shown to staff, including any discount. */
  lineViews(): { lineNo: number; productId: string; grossCents: number; discountCents: number; discountReason: string | null; subtotalCents: number }[] {
    return this.lines.map((l) => ({
      lineNo: l.lineNo,
      productId: l.productId,
      grossCents: l.gross().cents,
      discountCents: l.discountAmount().cents,
      discountReason: l.discountReason(),
      subtotalCents: l.subtotal().cents,
    }));
  }
}
