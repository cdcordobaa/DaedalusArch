import { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { Money } from '../../../shared-kernel/value-objects/Money';
import { WorkOrderCancelledEvent, WorkOrderCompletedEvent } from '../../contracts/WorkOrderContracts';

type WorkOrderStatus = 'open' | 'assigned' | 'completed' | 'cancelled';

export class WorkOrder {
  private status: WorkOrderStatus = 'open';
  private contractorId: string | undefined;
  private cost: Money | undefined;
  private events: DomainEvent[] = [];

  private constructor(
    readonly id: string,
    readonly propertyId: string,
    private readonly description: string,
    private readonly budget: Money,
  ) {}

  static open(id: string, propertyId: string, description: string, budget: Money): WorkOrder {
    if (!id.trim() || !propertyId.trim()) throw new Error('ids required');
    if (!description.trim()) throw new Error('description required');
    return new WorkOrder(id, propertyId, description, budget);
  }

  assign(contractorId: string): void {
    if (this.status !== 'open') throw new Error('work order not open');
    if (!contractorId.trim()) throw new Error('contractor required');
    this.contractorId = contractorId;
    this.status = 'assigned';
  }

  reassign(contractorId: string): void {
    if (this.status !== 'assigned') throw new Error('work order not assigned');
    if (!contractorId.trim()) throw new Error('contractor required');
    this.contractorId = contractorId;
  }

  complete(cost: Money): void {
    if (this.status !== 'assigned') throw new Error('work order not assigned');
    if (cost.isGreaterThan(this.budget)) throw new Error('cost exceeds budget');
    this.cost = cost;
    this.status = 'completed';
    const event: WorkOrderCompletedEvent = {
      name: 'WorkOrderCompleted',
      occurredAt: new Date(),
      workOrderId: this.id,
      propertyId: this.propertyId,
      costCents: cost.cents,
    };
    this.events.push(event);
  }

  cancel(): void {
    if (this.status === 'completed') throw new Error('already completed');
    if (this.status === 'cancelled') return;
    this.status = 'cancelled';
    const event: WorkOrderCancelledEvent = {
      name: 'WorkOrderCancelled',
      occurredAt: new Date(),
      workOrderId: this.id,
    };
    this.events.push(event);
  }

  recordCost(cost: Money): void {
    this.cost = cost;
  }

  currentStatus(): string {
    return this.status;
  }

  assignedContractor(): string | undefined {
    return this.contractorId;
  }

  budgetLimit(): Money {
    return this.budget;
  }

  finalCost(): Money | undefined {
    return this.cost;
  }

  pullEvents(): DomainEvent[] {
    const pulled = this.events;
    this.events = [];
    return pulled;
  }
}
