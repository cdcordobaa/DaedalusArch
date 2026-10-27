import { EventBus } from '../../shared-kernel/DomainEvent';
import { TransactionManager } from '../../shared-kernel/TransactionManager';
import { Money } from '../../shared-kernel/value-objects/Money';
import { WorkOrderView } from '../contracts/WorkOrderContracts';
import { WorkOrder } from '../domain/workorder/WorkOrder';
import { WorkOrderRepository } from '../domain/workorder/WorkOrderRepository';
import { ContractorNotifier } from './ContractorNotifier';

export class WorkOrderService {
  constructor(
    private readonly repo: WorkOrderRepository,
    private readonly notifier: ContractorNotifier,
    private readonly bus: EventBus,
    private readonly tx: TransactionManager,
  ) {}

  openWorkOrder(id: string, propertyId: string, description: string, budgetCents: number): void {
    this.tx.run(() => {
      this.repo.save(WorkOrder.open(id, propertyId, description, Money.of(budgetCents)));
    });
  }

  assignContractor(workOrderId: string, contractorId: string): void {
    this.tx.run(() => {
      const workOrder = this.load(workOrderId);
      workOrder.assign(contractorId);
      this.repo.save(workOrder);
    });
    this.notifier.notify(contractorId, 'Assigned ' + workOrderId);
  }

  completeWorkOrder(workOrderId: string, costCents: number): void {
    this.tx.run(() => {
      const workOrder = this.load(workOrderId);
      workOrder.complete(Money.of(costCents));
      this.repo.save(workOrder);
      this.bus.publish(workOrder.pullEvents());
    });
  }

  recordLabourCost(workOrderId: string, hours: number, rateCents: number): void {
    this.tx.run(() => {
      const workOrder = this.load(workOrderId);
      const base = hours * rateCents;
      const surcharge = hours > 8 ? Math.round(base * 0.25) : 0;
      const capped = Math.min(base + surcharge, workOrder.budgetLimit().cents);
      workOrder.recordCost(Money.of(capped));
      this.repo.save(workOrder);
    });
  }

  cancelWorkOrder(workOrderId: string): void {
    this.tx.run(() => {
      const workOrder = this.load(workOrderId);
      workOrder.cancel();
      this.repo.save(workOrder);
      this.bus.publish(workOrder.pullEvents());
    });
  }

  view(workOrderId: string): WorkOrderView {
    const workOrder = this.load(workOrderId);
    return { id: workOrder.id, propertyId: workOrder.propertyId, status: workOrder.currentStatus() };
  }

  private load(workOrderId: string): WorkOrder {
    const workOrder = this.repo.findById(workOrderId);
    if (!workOrder) throw new Error('work order not found');
    return workOrder;
  }
}
