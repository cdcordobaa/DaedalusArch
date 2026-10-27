import { WorkOrderCancelledEvent } from '../../workorders/contracts/WorkOrderContracts';
import { EventBus } from '../../shared-kernel/DomainEvent';
import { TransactionManager } from '../../shared-kernel/TransactionManager';
import { Money } from '../../shared-kernel/value-objects/Money';
import { WorkOrderCompletedEvent } from '../../workorders/contracts/WorkOrderContracts';
import { InvoiceView } from '../contracts/InvoiceContracts';
import { Invoice } from '../domain/invoice/Invoice';
import { InvoiceRepository } from '../domain/invoice/InvoiceRepository';

export class InvoiceService {
  constructor(
    private readonly repo: InvoiceRepository,
    private readonly bus: EventBus,
    private readonly tx: TransactionManager,
  ) {}

  onWorkOrderCompleted(event: WorkOrderCompletedEvent): void {
    this.tx.run(() => {
      if (this.repo.findByWorkOrder(event.workOrderId)) return;
      const invoice = Invoice.draft('INV-' + event.workOrderId, event.workOrderId, event.propertyId);
      invoice.addLine({ description: 'Work order ' + event.workOrderId, amount: Money.of(event.costCents) });
      this.repo.save(invoice);
    });
  }

  addLine(invoiceId: string, description: string, amountCents: number): void {
    this.tx.run(() => {
      const invoice = this.load(invoiceId);
      invoice.addLine({ description, amount: Money.of(amountCents) });
      this.repo.save(invoice);
    });
  }

  issue(invoiceId: string): void {
    this.tx.run(() => {
      const invoice = this.load(invoiceId);
      invoice.issue();
      this.repo.save(invoice);
    });
  }

  markPaid(invoiceId: string): void {
    this.tx.run(() => {
      const invoice = this.load(invoiceId);
      invoice.markPaid();
      this.repo.save(invoice);
    });
  }

  view(invoiceId: string): InvoiceView {
    const invoice = this.load(invoiceId);
    return {
      id: invoice.id,
      workOrderId: invoice.workOrderId,
      status: invoice.currentStatus(),
      totalCents: invoice.total().cents,
    };
  }

  private load(invoiceId: string): Invoice {
    const invoice = this.repo.findById(invoiceId);
    if (!invoice) throw new Error('invoice not found');
    return invoice;
  }

  onWorkOrderCancelled(event: WorkOrderCancelledEvent): void {
    this.tx.run(() => {
      const invoice = this.repo.findByWorkOrder(event.workOrderId);
      if (!invoice) return;
      invoice.cancel();
      this.repo.save(invoice);
    });
  }
}
