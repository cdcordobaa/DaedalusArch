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

  private readonly locks = new Set<string>();

  completeWorkOrder(workOrderId: string, costCents: number): void {
    if (this.locks.has(workOrderId)) throw new Error('work order busy');
    this.locks.add(workOrderId);
    try {
      this.tx.run(() => {
        const workOrder = this.load(workOrderId);
        workOrder.complete(Money.of(costCents));
        this.repo.save(workOrder);
        this.bus.publish(workOrder.pullEvents());
      });
    } finally {
      this.locks.delete(workOrderId);
    }
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
