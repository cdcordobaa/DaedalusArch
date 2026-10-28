import { DomainEvent } from '../../../shared-kernel/DomainEvent';

export class ProductionClosed implements DomainEvent {
  readonly name = 'ProductionClosed';
  readonly occurredAt = Date.now();

  constructor(
    readonly productionId: string,
    readonly roomId: string,
  ) {}
}
