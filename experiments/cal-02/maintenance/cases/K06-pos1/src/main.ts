import { EventBus } from './shared-kernel/DomainEvent';
import { InMemoryTransactionManager } from './shared-kernel/TransactionManager';
import { InMemoryPropertyRepository, PropertyService } from './properties/index';
import {
  InMemoryWorkOrderRepository,
  RecordingContractorNotifier,
  WorkOrderService,
} from './workorders/index';
import type { WorkOrderCompletedEvent } from './workorders/index';
import { InMemoryInvoiceRepository, InvoiceService } from './invoicing/index';

export function createApp() {
  const bus = new EventBus();
  const tx = new InMemoryTransactionManager();
  const notifier = new RecordingContractorNotifier();
  const properties = new PropertyService(new InMemoryPropertyRepository(), bus, tx);
  const workOrders = new WorkOrderService(new InMemoryWorkOrderRepository(), notifier, bus, tx);
  const invoices = new InvoiceService(new InMemoryInvoiceRepository(), bus, tx);

  bus.subscribe('WorkOrderCompleted', (e: WorkOrderCompletedEvent) => properties.onWorkOrderCompleted(e));
  bus.subscribe('WorkOrderCompleted', (e: WorkOrderCompletedEvent) => invoices.onWorkOrderCompleted(e));
  const completeAndRecordVisit = (workOrderId: string, propertyId: string, costCents: number): void => {
    workOrders.completeWorkOrder(workOrderId, costCents);
    properties.recordMaintenanceVisit(propertyId);
  };

  return { properties, workOrders, invoices, notifier, completeAndRecordVisit };
}
