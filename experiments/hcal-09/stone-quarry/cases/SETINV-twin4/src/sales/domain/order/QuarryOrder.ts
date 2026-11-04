import { EmptyOrderError } from './EmptyOrderError';
import { OrderLine } from './value-objects/OrderLine';

export class QuarryOrder {
  private delivered = 0;

  private constructor(
    readonly id: string,
    readonly customerId: string,
    private readonly lines: OrderLine[],
  ) {}

  /** Invariant order-has-lines: an order always has at least one line. */
  static place(id: string, customerId: string, lines: readonly OrderLine[]): QuarryOrder {
    if (lines.length === 0) throw new EmptyOrderError(id);
    return new QuarryOrder(id, customerId, [...lines]);
  }

  removeLine(index: number): void {
    if (index < 0 || index >= this.lines.length) return;
    if (this.lines.length === 1) throw new EmptyOrderError(this.id);
    this.lines.splice(index, 1);
  }

  recordDelivery(tonnes: number): void {
    this.delivered += tonnes;
  }

  get orderedTonnes(): number {
    return this.lines.reduce((sum, l) => sum + l.tonnes, 0);
  }

  get deliveredTonnes(): number {
    return this.delivered;
  }

  get lineCount(): number {
    return this.lines.length;
  }
}
