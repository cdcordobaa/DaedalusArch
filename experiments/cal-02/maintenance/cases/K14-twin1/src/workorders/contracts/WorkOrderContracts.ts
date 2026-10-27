import { DomainEvent } from '../../shared-kernel/DomainEvent';

export interface WorkOrderView {
  readonly id: string;
  readonly propertyId: string;
  readonly status: string;
}

export interface WorkOrderCompletedEvent extends DomainEvent {
  readonly name: 'WorkOrderCompleted';
  readonly workOrderId: string;
  readonly propertyId: string;
  readonly costCents: number;
}

export interface WorkOrderCancelledEvent extends DomainEvent {
  readonly name: 'WorkOrderCancelled';
  readonly workOrderId: string;
}

export interface WorkOrderDetail {
  readonly id: string;
  readonly propertyId: string;
  readonly status: string;
  readonly contractorId: string | undefined;
}
