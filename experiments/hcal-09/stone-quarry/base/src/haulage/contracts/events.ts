import { DomainEvent } from '../../shared-kernel/DomainEvent';

export interface HaulRecorded extends DomainEvent {
  readonly type: 'haulage.HaulRecorded';
  readonly haulId: string;
  readonly orderId: string;
  readonly tonnes: number;
}
