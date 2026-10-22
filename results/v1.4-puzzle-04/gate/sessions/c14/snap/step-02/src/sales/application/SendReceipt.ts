import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import type { OrderPlaced } from '../domain/order/events/OrderPlaced';
import type { Receipts } from './ports/Receipts';
import type { ReceiptFooter } from './ReceiptFooter';

export class SendReceipt {
  constructor(
    private readonly receipts: Receipts,
    private readonly footer: ReceiptFooter,
  ) {}

  handle(event: DomainEvent): void {
    const placed = event as OrderPlaced;
    const total = `${placed.currency} ${(placed.totalCents / 100).toFixed(2)}`;
    this.receipts.add(`Order ${placed.orderId}: ${total}. ${this.footer.footerFor(placed.memberId)}`);
  }
}
